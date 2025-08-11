"""
Job Management API Routes
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
from typing import List, Optional
from pydantic import BaseModel

from services.job_queue import job_queue, JobStatus, JobType
from services.subtitle_service import SubtitleService

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

class JobResponse(BaseModel):
    """Response model for job data"""
    id: str
    type: str
    title: str
    description: str
    status: str
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    progress: dict
    result: Optional[dict] = None
    error: Optional[str] = None
    metadata: dict

class CreateBulkJobRequest(BaseModel):
    """Request to create a bulk dual subtitle job"""
    show_id: str
    show_title: str
    primary_language: str
    secondary_language: str
    styling_config: dict
    episode_configs: Optional[dict] = None

@router.get("/", response_model=List[JobResponse])
async def get_jobs(status: Optional[str] = None):
    """Get all jobs, optionally filtered by status"""
    
    status_filter = None
    if status:
        try:
            status_filter = JobStatus(status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
    
    jobs = job_queue.get_all_jobs(status_filter)
    return [JobResponse(**job.to_dict()) for job in jobs]

@router.get("/active", response_model=List[JobResponse])
async def get_active_jobs():
    """Get all pending and running jobs"""
    jobs = job_queue.get_active_jobs()
    return [JobResponse(**job.to_dict()) for job in jobs]

@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str):
    """Get job details by ID"""
    job = job_queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    try:
        return JobResponse(**job.to_dict())
    except Exception as e:
        print(f"Error serializing job {job_id}: {e}")
        # Return a minimal safe response
        return JobResponse(
            id=job.id,
            type=job.type.value,
            title=job.title,
            description=job.description,
            status=job.status.value,
            created_at=job.created_at.isoformat(),
            started_at=job.started_at.isoformat() if job.started_at else None,
            completed_at=job.completed_at.isoformat() if job.completed_at else None,
            progress={
                'current_step': job.progress.current_step,
                'current_item': job.progress.current_item,
                'processed': job.progress.processed,
                'total': job.progress.total,
                'percentage': job.progress.percentage,
                'estimated_time_remaining': job.progress.estimated_time_remaining,
                'details': {}
            },
            result=job.result,
            error=job.error,
            metadata={}
        )

@router.post("/{job_id}/cancel")
async def cancel_job(job_id: str):
    """Cancel a job"""
    result = job_queue.cancel_job(job_id)
    if result is False:
        job = job_queue.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        elif job.status in ["completed", "failed", "cancelled"]:
            raise HTTPException(status_code=400, detail=f"Job is already {job.status} and cannot be cancelled")
        else:
            raise HTTPException(status_code=400, detail="Job is currently running and cannot be cancelled")
    
    return {"success": True, "message": "Job cancelled successfully"}

@router.post("/bulk-dual-subtitle")
async def create_bulk_dual_subtitle_job(request: CreateBulkJobRequest, background_tasks: BackgroundTasks, http_request: Request):
    """Create and start a bulk dual subtitle creation job"""
    
    # Get Plex token from request headers
    plex_token = http_request.headers.get("x-plex-token")
    print(f"DEBUG: Received Plex token: {plex_token[:20] if plex_token else 'None'}...")
    if not plex_token:
        raise HTTPException(status_code=401, detail="Plex authentication required")
    
    # Create the job
    job_id = job_queue.create_job(
        job_type=JobType.BULK_DUAL_SUBTITLE,
        title=f"Bulk Dual Subtitles: {request.show_title}",
        description=f"Creating {request.primary_language} + {request.secondary_language} dual subtitles",
        parameters={
            'show_id': request.show_id,
            'show_title': request.show_title,
            'primary_language': request.primary_language,
            'secondary_language': request.secondary_language,
            'styling_config': request.styling_config,
            'episode_configs': request.episode_configs or {},
            'token': plex_token  # Pass the Plex token to the job
        },
        metadata={
            'show_id': request.show_id,
            'show_title': request.show_title,
            'languages': f"{request.primary_language}+{request.secondary_language}"
        }
    )
    
    # Start the job immediately if there's capacity
    def bulk_subtitle_job(job_id: str, progress_callback, **params):
        """Background job function for bulk subtitle creation"""
        # Extract the parameters from the job parameters, not the request
        job = job_queue.get_job(job_id)
        if not job:
            raise Exception("Job not found")
            
        return SubtitleService.process_bulk_dual_subtitles_job(
            job_id=job_id,
            progress_callback=progress_callback,
            **job.parameters  # Use job parameters which include the token
        )
    
    started = job_queue.start_job(
        job_id, 
        bulk_subtitle_job
    )
    
    job = job_queue.get_job(job_id)
    
    return {
        "job_id": job_id,
        "status": job.status.value if job else "unknown",
        "started_immediately": started,
        "message": "Job created and started" if started else "Job created and queued"
    }

@router.delete("/cleanup")
async def cleanup_old_jobs():
    """Clean up old completed/failed jobs"""
    removed_count = job_queue.cleanup_old_jobs()
    return {
        "success": True,
        "removed_jobs": removed_count,
        "message": f"Cleaned up {removed_count} old jobs"
    }

@router.get("/stats/summary")
async def get_job_stats():
    """Get job queue statistics"""
    all_jobs = job_queue.get_all_jobs()
    
    stats = {
        "total": len(all_jobs),
        "pending": len([j for j in all_jobs if j.status == JobStatus.PENDING]),
        "running": len([j for j in all_jobs if j.status == JobStatus.RUNNING]),
        "completed": len([j for j in all_jobs if j.status == JobStatus.COMPLETED]),
        "failed": len([j for j in all_jobs if j.status == JobStatus.FAILED]),
        "cancelled": len([j for j in all_jobs if j.status == JobStatus.CANCELLED]),
        "max_concurrent": job_queue.max_concurrent_jobs
    }
    
    return stats