import time
import asyncio

from logging import LoggerAdapter
from datetime import datetime


class AsyncTaskManager:
    """
    A class for managing a queue of tasks using a worker paradigm.
    """

    def __init__(
        self,
        tasks: list,
        logger: LoggerAdapter | None = None,
        log_message_prefix: str = "Completed task"
    ) -> None:
        """
        Initialize an AsyncTaskManager for a specific list of tasks.
        """
        self.tasks = tasks
        self.task_queue = [] # queue of currently scheduled tasks
        self.num_tasks = len(tasks)
        self.num_completed_tasks = 0
        self.num_active_workers = 0
        self.results = [None] * self.num_tasks # results to return
        self.logger = logger
        self.log_message_prefix = log_message_prefix # what to log after completing each task

        if logger:
            logger.info("Created an AsyncTaskManager for %d tasks", self.num_tasks)

    @classmethod
    async def collect_all(
        cls,
        tasks: list,
        num_workers: int,
        logger: LoggerAdapter | None = None,
        log_message_prefix: str = "Completed task",
        return_exceptions: bool = False
    ) -> list:
        """
        Schedule and complete a list of tasks concurrently (in the event loop)
        using a specified number of workers.
        """

        task_manager = AsyncTaskManager(
            tasks,
            logger,
            log_message_prefix
        )
        
        results = await task_manager._collect(num_workers, return_exceptions)
        return results
    
    async def _collect(self, num_workers: int, return_exceptions: bool = False):
        """
        Schedules and completes all tasks in the task_queue. Only logs if a
        logger is provided.
        """

        if self.logger:
            self.logger.info(
                "Collecting %d tasks using %d workers",
                self.num_tasks,
                num_workers
            )

        self.task_queue = list(reversed([
            (i, self.task_wrapper(task, return_exceptions)) for i, task in enumerate(self.tasks)
        ])) # reversed so that we perform the tasks in order (more or less)

        if num_workers > self.num_tasks:
            num_workers = self.num_tasks

        worker_tasks = [
            self.run_worker() for _ in range(num_workers)
        ]

        # Run the workers
        await asyncio.gather(*worker_tasks)

        # Result will have been updated automatically by the workers
        return self.results
    
    async def task_wrapper(self, task, return_exceptions):
        """
        Wrapper for asyncio tasks. Serves as middleware to log intermediate
        results.
        """

        start_time = time.time()
        start_datetime = datetime.now().strftime("%H:%M:%S")

        try:
            result = await task
            self.num_completed_tasks += 1
            if self.logger:
                end_time = time.time()
                duration = end_time - start_time
                log_message = f"{self.log_message_prefix} {self.num_completed_tasks} of {self.num_tasks} (duration: {duration:.2f} seconds, request sent: {start_datetime})"
        
        except Exception as e:
            self.num_completed_tasks += 1
            if not return_exceptions:
                raise e
            
            end_time = time.time()
            duration = end_time - start_time
            log_message = f" [ERROR UNSUCCESSFUL] {self.log_message_prefix} {self.num_completed_tasks} of {self.num_tasks} (duration: {duration:.2f} seconds, request sent: {start_datetime}); REASON: {str(e)}"
            result = e
        
        self.logger.info(log_message)
        return result

    async def run_worker(self):
        """
        A worker task that consumes from the task_queue until it is empty.
        """

        self.num_active_workers += 1
        worker_id = self.num_active_workers

        if self.logger:
            self.logger.debug(f" [Worker {worker_id}] Worker {self.num_active_workers} started")

        while self.task_queue:
            self.logger.debug(f" [Worker {worker_id}] Task queue length: {len(self.task_queue)}")
            id, task = self.task_queue.pop()
            self.logger.debug(f" [Worker {worker_id}] About to run task for id {id}")
            result = await task
            self.results[id] = result
            self.logger.debug(f" [Worker {worker_id}] Completed task for id {id}")
