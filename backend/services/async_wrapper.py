"""
Async wrapper for CPU-intensive subtitle operations
"""

import asyncio
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
from functools import partial, wraps
from typing import Any, Callable, Optional
import logging

import sys
from pathlib import Path
# Add backend directory to path
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from config import settings

logger = logging.getLogger(__name__)


class AsyncExecutor:
    """
    Manages async execution of CPU-intensive tasks
    """
    
    _instance = None
    _thread_executor = None
    _process_executor = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    @property
    def thread_executor(self) -> ThreadPoolExecutor:
        """Get or create thread executor"""
        if self._thread_executor is None:
            self._thread_executor = ThreadPoolExecutor(
                max_workers=settings.app.max_workers,
                thread_name_prefix="subtitle_worker"
            )
        return self._thread_executor
    
    @property
    def process_executor(self) -> ProcessPoolExecutor:
        """Get or create process executor for heavy CPU tasks"""
        if self._process_executor is None:
            self._process_executor = ProcessPoolExecutor(
                max_workers=max(1, settings.app.max_workers // 2)
            )
        return self._process_executor
    
    async def run_in_thread(self, func: Callable, *args, **kwargs) -> Any:
        """Run function in thread pool"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self.thread_executor,
            partial(func, *args, **kwargs)
        )
    
    async def run_in_process(self, func: Callable, *args, **kwargs) -> Any:
        """Run function in process pool (for CPU-heavy tasks)"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self.process_executor,
            partial(func, *args, **kwargs)
        )
    
    def shutdown(self):
        """Shutdown executors"""
        if self._thread_executor:
            self._thread_executor.shutdown(wait=True)
            self._thread_executor = None
        if self._process_executor:
            self._process_executor.shutdown(wait=True)
            self._process_executor = None


# Global executor instance
async_executor = AsyncExecutor()


def run_async_in_thread(func: Callable) -> Callable:
    """
    Decorator to automatically run function in thread pool
    
    Usage:
        @run_async_in_thread
        def cpu_intensive_task(data):
            # ... heavy processing
            return result
        
        # In async context:
        result = await cpu_intensive_task(data)
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        return await async_executor.run_in_thread(func, *args, **kwargs)
    return wrapper


def run_async_in_process(func: Callable) -> Callable:
    """
    Decorator to automatically run function in process pool
    
    Usage:
        @run_async_in_process
        def very_cpu_intensive_task(data):
            # ... very heavy processing
            return result
        
        # In async context:
        result = await very_cpu_intensive_task(data)
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        return await async_executor.run_in_process(func, *args, **kwargs)
    return wrapper


class AsyncSubtitleProcessor:
    """
    Async wrapper for subtitle processing operations
    """
    
    def __init__(self):
        from services.subtitle_creator import DualSubtitleCreator
        from services.language_detector import SimpleLanguageDetector
        from services.sync_plugins import SubtitleSynchronizer
        
        self.dual_creator = DualSubtitleCreator()
        self.language_detector = SimpleLanguageDetector()
        self.synchronizer = SubtitleSynchronizer()
    
    async def create_dual_subtitle(
        self,
        primary_path: str,
        secondary_path: str,
        output_path: str,
        config=None,
        video_path: Optional[str] = None
    ):
        """Async wrapper for dual subtitle creation"""
        
        # Run CPU-intensive subtitle creation in thread pool
        result = await async_executor.run_in_thread(
            self.dual_creator.create_dual_subtitle,
            primary_path,
            secondary_path,
            output_path,
            config,
            video_path
        )
        
        return result
    
    async def detect_language(self, file_path: str, declared_lang: Optional[str] = None):
        """Async wrapper for language detection"""
        
        from pathlib import Path
        
        # Run language detection in thread pool
        result = await async_executor.run_in_thread(
            self.language_detector.detect_from_file,
            Path(file_path),
            declared_lang
        )
        
        return result
    
    async def sync_subtitles(
        self,
        reference_path: str,
        target_path: str,
        output_path: str,
        method=None,
        **kwargs
    ):
        """Async wrapper for subtitle synchronization"""
        
        # Run synchronization in thread pool
        result = await async_executor.run_in_thread(
            self.synchronizer.sync_subtitles,
            reference_path,
            target_path,
            output_path,
            method,
            **kwargs
        )
        
        return result
    
    async def extract_embedded_subtitle(
        self,
        video_path: str,
        stream_index: int,
        output_path: str,
        codec: str = None
    ):
        """Async wrapper for embedded subtitle extraction"""
        
        import ffmpeg
        from pathlib import Path
        
        async def extract():
            try:
                # Determine output format based on codec and file extension
                output_ext = Path(output_path).suffix.lower()
                
                # If codec is ASS/SSA and output path has .ass extension, preserve format
                if codec and codec.lower() in ['ass', 'ssa'] and output_ext == '.ass':
                    output_format = 'ass'
                elif codec and codec.lower() in ['ass', 'ssa'] and output_ext == '.ssa':
                    output_format = 'ssa'
                else:
                    # Default to SRT for compatibility
                    output_format = 'srt'
                
                # Build ffmpeg command
                input_stream = ffmpeg.input(video_path)
                output = ffmpeg.output(
                    input_stream,
                    output_path,
                    **{'map': f'0:{stream_index}', 'f': output_format}
                )
                
                # Run in thread pool
                await async_executor.run_in_thread(
                    ffmpeg.run,
                    output,
                    overwrite_output=True,
                    quiet=False
                )
                
                return {
                    'success': True,
                    'output_path': output_path,
                    'stream_index': stream_index
                }
            except ffmpeg.Error as e:
                error_msg = f"FFmpeg error: {e.stderr.decode() if e.stderr else str(e)}"
                return {
                    'success': False,
                    'error': error_msg
                }
            except Exception as e:
                return {
                    'success': False,
                    'error': str(e)
                }
        
        return await extract()
    
    async def batch_process_subtitles(
        self,
        tasks: list,
        max_concurrent: int = 3
    ):
        """
        Process multiple subtitle tasks concurrently
        
        Args:
            tasks: List of dictionaries with task parameters
            max_concurrent: Maximum concurrent operations
            
        Returns:
            List of results
        """
        
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def process_task(task):
            async with semaphore:
                task_type = task.get('type')
                
                if task_type == 'dual_subtitle':
                    return await self.create_dual_subtitle(
                        task['primary_path'],
                        task['secondary_path'],
                        task['output_path'],
                        task.get('config'),
                        task.get('video_path')
                    )
                elif task_type == 'sync':
                    return await self.sync_subtitles(
                        task['reference_path'],
                        task['target_path'],
                        task['output_path'],
                        task.get('method')
                    )
                elif task_type == 'language_detect':
                    return await self.detect_language(
                        task['file_path'],
                        task.get('declared_lang')
                    )
                else:
                    return {'error': f'Unknown task type: {task_type}'}
        
        # Process all tasks concurrently
        results = await asyncio.gather(
            *[process_task(task) for task in tasks],
            return_exceptions=True
        )
        
        # Convert exceptions to error results
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append({
                    'success': False,
                    'error': str(result),
                    'task_index': i
                })
            else:
                processed_results.append(result)
        
        return processed_results


# Cleanup function for graceful shutdown
async def cleanup_async_resources():
    """Clean up async resources on shutdown"""
    logger.info("Cleaning up async resources...")
    async_executor.shutdown()
    logger.info("Async resources cleaned up")