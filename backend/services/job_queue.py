"""
Background Job Queue System
Handles long-running tasks like bulk subtitle processing
"""

import asyncio
import uuid
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, asdict
from enum import Enum
import json
import threading
from concurrent.futures import ThreadPoolExecutor
import traceback

class JobStatus(Enum):
    PENDING = "pending"
    RUNNING = "running" 
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class JobType(Enum):
    BULK_DUAL_SUBTITLE = "bulk_dual_subtitle"
    SINGLE_SUBTITLE_SYNC = "single_subtitle_sync"
    SUBTITLE_EXTRACTION = "subtitle_extraction"

@dataclass
class JobProgress:
    """Progress information for a job"""
    current_step: str = ""
    current_item: str = ""
    processed: int = 0
    total: int = 0
    percentage: float = 0.0
    estimated_time_remaining: str = ""
    details: Dict[str, Any] = None

    def __post_init__(self):
        if self.details is None:
            self.details = {}
        # Auto-calculate percentage
        if self.total > 0:
            self.percentage = (self.processed / self.total) * 100

@dataclass
class Job:
    """Represents a background job"""
    id: str
    type: JobType
    title: str
    description: str
    status: JobStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    progress: JobProgress = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    parameters: Dict[str, Any] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.progress is None:
            self.progress = JobProgress()
        if self.parameters is None:
            self.parameters = {}
        if self.metadata is None:
            self.metadata = {}

    def to_dict(self) -> Dict[str, Any]:
        """Convert job to dictionary for JSON serialization"""
        # Manual conversion to avoid issues with thread locks and other non-serializable objects
        data = {
            'id': self.id,
            'type': self.type.value,
            'title': self.title,
            'description': self.description,
            'status': self.status.value,
            'created_at': self.created_at.isoformat(),
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'progress': {
                'current_step': self.progress.current_step,
                'current_item': self.progress.current_item,
                'processed': self.progress.processed,
                'total': self.progress.total,
                'percentage': self.progress.percentage,
                'estimated_time_remaining': self.progress.estimated_time_remaining,
                'details': self.progress.details.copy() if self.progress.details else {}
            },
            'result': self.result,
            'error': self.error,
            'parameters': self._safe_copy_dict(self.parameters) if self.parameters else {},
            'metadata': self._safe_copy_dict(self.metadata) if self.metadata else {}
        }
        return data
    
    def _safe_copy_dict(self, d: Dict[str, Any]) -> Dict[str, Any]:
        """Safely copy a dictionary, excluding non-serializable objects"""
        safe_dict = {}
        # Skip known problematic keys
        skip_keys = {'future', '_lock', 'executor'}
        
        for key, value in d.items():
            if key in skip_keys:
                continue
                
            try:
                # Test if value is JSON serializable
                import json
                json.dumps(value)
                safe_dict[key] = value
            except (TypeError, ValueError):
                # Skip non-serializable values, but indicate what was skipped
                safe_dict[key] = f"<non-serializable: {type(value).__name__}>"
        return safe_dict

class JobQueue:
    """Thread-safe job queue manager"""
    
    def __init__(self, max_concurrent_jobs: int = 2):
        self.jobs: Dict[str, Job] = {}
        self.max_concurrent_jobs = max_concurrent_jobs
        self.executor = ThreadPoolExecutor(max_workers=max_concurrent_jobs)
        self._lock = threading.Lock()
        self._running_jobs: Dict[str, threading.Thread] = {}
        
        # Job cleanup settings
        self.cleanup_completed_after = timedelta(hours=24)  # Keep completed jobs for 24h
        self.cleanup_failed_after = timedelta(hours=72)     # Keep failed jobs for 72h
        
    def create_job(
        self,
        job_type: JobType,
        title: str,
        description: str,
        parameters: Dict[str, Any],
        metadata: Dict[str, Any] = None
    ) -> str:
        """Create a new job and add it to the queue"""
        
        job_id = str(uuid.uuid4())
        job = Job(
            id=job_id,
            type=job_type,
            title=title,
            description=description,
            status=JobStatus.PENDING,
            created_at=datetime.now(),
            parameters=parameters,
            metadata=metadata or {}
        )
        
        with self._lock:
            self.jobs[job_id] = job
            
        return job_id
    
    def get_job(self, job_id: str) -> Optional[Job]:
        """Get job by ID"""
        with self._lock:
            return self.jobs.get(job_id)
    
    def get_all_jobs(self, status_filter: Optional[JobStatus] = None) -> List[Job]:
        """Get all jobs, optionally filtered by status"""
        with self._lock:
            jobs = list(self.jobs.values())
            
        if status_filter:
            jobs = [job for job in jobs if job.status == status_filter]
            
        # Sort by created date, newest first
        return sorted(jobs, key=lambda j: j.created_at, reverse=True)
    
    def get_active_jobs(self) -> List[Job]:
        """Get all pending and running jobs"""
        with self._lock:
            return [
                job for job in self.jobs.values() 
                if job.status in [JobStatus.PENDING, JobStatus.RUNNING]
            ]
    
    def start_job(self, job_id: str, job_func: Callable, *args, **kwargs) -> bool:
        """Start executing a job"""
        
        with self._lock:
            job = self.jobs.get(job_id)
            if not job:
                return False
                
            if job.status != JobStatus.PENDING:
                return False
                
            # Check if we have capacity for another job
            running_count = len([j for j in self.jobs.values() if j.status == JobStatus.RUNNING])
            if running_count >= self.max_concurrent_jobs:
                return False
                
            job.status = JobStatus.RUNNING
            job.started_at = datetime.now()
        
        # Create progress callback
        def progress_callback(progress_info: Dict[str, Any]):
            self.update_job_progress(job_id, progress_info)
        
        # Start job in thread pool
        def job_wrapper():
            try:
                result = job_func(job_id, progress_callback, *args, **kwargs)
                self.complete_job(job_id, result)
            except Exception as e:
                error_msg = f"{str(e)}\n\nTraceback:\n{traceback.format_exc()}"
                self.fail_job(job_id, error_msg)
        
        future = self.executor.submit(job_wrapper)
        
        # Store the future so we can cancel if needed
        with self._lock:
            job.metadata['future'] = future
            
        return True
    
    def update_job_progress(self, job_id: str, progress_info: Dict[str, Any]):
        """Update job progress"""
        with self._lock:
            job = self.jobs.get(job_id)
            if job and job.status == JobStatus.RUNNING:
                # Update progress fields
                if 'current_step' in progress_info:
                    job.progress.current_step = progress_info['current_step']
                if 'current_item' in progress_info:
                    job.progress.current_item = progress_info['current_item']
                if 'processed' in progress_info:
                    job.progress.processed = progress_info['processed']
                if 'total' in progress_info:
                    job.progress.total = progress_info['total']
                if 'estimated_time_remaining' in progress_info:
                    job.progress.estimated_time_remaining = progress_info['estimated_time_remaining']
                if 'details' in progress_info:
                    job.progress.details.update(progress_info['details'])
                
                # Recalculate percentage
                if job.progress.total > 0:
                    job.progress.percentage = (job.progress.processed / job.progress.total) * 100
                
                # Clean up any thread locks or futures from metadata to avoid serialization issues
                if 'future' in job.metadata:
                    # Don't include the future in serialization, but keep the reference for cancellation
                    pass
    
    def complete_job(self, job_id: str, result: Dict[str, Any]):
        """Mark job as completed"""
        with self._lock:
            job = self.jobs.get(job_id)
            if job:
                job.status = JobStatus.COMPLETED
                job.completed_at = datetime.now()
                job.result = result
                job.progress.percentage = 100.0
                job.progress.current_step = "Completed"
                
                # Clean up future reference
                if 'future' in job.metadata:
                    del job.metadata['future']
    
    def fail_job(self, job_id: str, error: str):
        """Mark job as failed"""
        with self._lock:
            job = self.jobs.get(job_id)
            if job:
                job.status = JobStatus.FAILED
                job.completed_at = datetime.now()
                job.error = error
                job.progress.current_step = "Failed"
                
                # Clean up future reference
                if 'future' in job.metadata:
                    del job.metadata['future']
    
    def cancel_job(self, job_id: str) -> bool:
        """Cancel a job"""
        with self._lock:
            job = self.jobs.get(job_id)
            if not job:
                return False
                
            if job.status == JobStatus.PENDING:
                job.status = JobStatus.CANCELLED
                job.completed_at = datetime.now()
                job.progress.current_step = "Cancelled"
                return True
            elif job.status == JobStatus.RUNNING:
                # Set cancellation flag that job can check
                job.metadata['cancelled'] = True
                job.progress.current_step = "Cancelling..."
                
                # Try to cancel the future
                future = job.metadata.get('future')
                if future:
                    cancelled = future.cancel()
                    if cancelled:
                        job.status = JobStatus.CANCELLED
                        job.completed_at = datetime.now()
                        job.progress.current_step = "Cancelled"
                        del job.metadata['future']
                        return True
                
                # If future cancellation failed, the job will check the cancelled flag
                # and stop itself gracefully
                return True
            else:
                return False
    
    def is_job_cancelled(self, job_id: str) -> bool:
        """Check if a job has been requested to cancel"""
        with self._lock:
            job = self.jobs.get(job_id)
            if not job:
                return False
            return job.metadata.get('cancelled', False)
    
    def mark_job_cancelled(self, job_id: str):
        """Mark a job as cancelled (called by the job itself when it detects cancellation)"""
        with self._lock:
            job = self.jobs.get(job_id)
            if job and job.status == JobStatus.RUNNING:
                job.status = JobStatus.CANCELLED
                job.completed_at = datetime.now()
                job.progress.current_step = "Cancelled"
                # Clean up future reference
                if 'future' in job.metadata:
                    del job.metadata['future']
    
    def cleanup_old_jobs(self):
        """Remove old completed/failed jobs"""
        now = datetime.now()
        to_remove = []
        
        with self._lock:
            for job_id, job in self.jobs.items():
                if job.status == JobStatus.COMPLETED and job.completed_at:
                    if now - job.completed_at > self.cleanup_completed_after:
                        to_remove.append(job_id)
                elif job.status == JobStatus.FAILED and job.completed_at:
                    if now - job.completed_at > self.cleanup_failed_after:
                        to_remove.append(job_id)
            
            for job_id in to_remove:
                del self.jobs[job_id]
        
        return len(to_remove)

# Global job queue instance
job_queue = JobQueue(max_concurrent_jobs=2)