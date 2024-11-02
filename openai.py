import tiktoken
import json
import time
import logging
import asyncio

from openai import OpenAI, AsyncOpenAI
from concurrent.futures import ThreadPoolExecutor, as_completed
from timeline.utils.task_manager import AsyncTaskManager

logger = logging.getLogger(__name__)

class AliasDict(dict):

    def __init__(self, data: dict, aliases: dict):
        """
        A dict that has aliases. The param `aliases` is a dict of alias
        mappings to root names, e.g. {"hi": "hello", "1": "one"}.
        """
        super().__init__(data)
        self.aliases = aliases

    def __getitem__(self, name: str):
        # If the key is in aliases, fetch the actual key
        if name in self.aliases:
            name = self.aliases[name]
        return super().__getitem__(name)


# TODO: deal with token limit

class OpenAICallManager:
    """
    Class to centralize and manage calls to OpenAI. All calls should be made
    through the make_requests method.
    """

    # OpenAI rate limits and capacity
    OPENAI_RATE_LIMITS = AliasDict(
        data = {
            "gpt-4o": {
                "TPM": 30_000_000,
                "RPM": 10_000,
                "TPR": 128_000 # tokens per request limit
            },
            "gpt-4o-mini": {
                "TPM": 150_000_000,
                "RPM": 30_000,
                "TPR": 128_000
            }
        },
        aliases = {
            "gpt-4o-2024-08-06": "gpt-4o"
        }
    )

    def __init__(self, openai_api_key: str, max_capacity: float = 0.3) -> None:
        
        # Rate limits
        self.limits = AliasDict(
            data = {
                model: {
                    "TPM": int(limit["TPM"] * max_capacity),
                    "RPM": int(limit["RPM"] * max_capacity)
                }
                for model, limit in self.OPENAI_RATE_LIMITS.items()
            },
            aliases=self.OPENAI_RATE_LIMITS.aliases
        )

        # Usage tracking for async calls
        self.usage = AliasDict(
            data = {
                model: {
                    "tokens_used": 0,
                    "requests_made": 0,
                    "last_reset_time": time.time() # TODO: make more granular
                }
                for model in self.OPENAI_RATE_LIMITS.keys()
            },
            aliases = self.OPENAI_RATE_LIMITS.aliases
        )

        # GPT clients
        self.gpt_client_sync = OpenAI(api_key=openai_api_key)
        self.gpt_client_async = AsyncOpenAI(api_key=openai_api_key)

    @classmethod
    def num_token_from_text(cls, text: str, model: str) -> int:
        """
        Get the number of tokens for some given text.
        """
        encoding = tiktoken.encoding_for_model(model)
        return len(encoding.encode(text))
    
    @classmethod
    def num_tokens_from_messages(cls, messages: list[dict], model: str):
        """
        Count the number of tokens in the messages parameter.
        """

        # Get the encoding for the specified model
        encoding = tiktoken.encoding_for_model(model)
        num_tokens = 0

        for message in messages:
            # Count tokens for the role (system/user/assistant)
            num_tokens += len(encoding.encode(message["role"]))
            # Count tokens for the content (text)
            num_tokens += len(encoding.encode(message["content"]))
            
            # If there is a name key (optional), count tokens for it
            if "name" in message:
                num_tokens += len(encoding.encode(message["name"]))

        # Add tokens for the message separators
        num_tokens += 2 * len(messages)  # 2 extra tokens for each message's separator

        return num_tokens
    
    def request_is_under_token_limit(self, params: dict) -> bool:
        """
        Return True if the param_dict represents an OpenAI API requests that
        will stay under the token limit.
        """
        
        model = params["model"]
        messages = params["messages"]
        num_tokens = OpenAICallManager.num_tokens_from_messages(messages, model)
        return num_tokens <= OpenAICallManager.OPENAI_RATE_LIMITS[model]["TPR"]
    
    def requests_are_under_token_limit(self, request_list: list[dict]) -> bool:
        """
        Ensure that the each of the requests to OpenAI fall under the token
        limit.
        """

        for params in request_list:
            if not self.request_is_under_token_limit(params):
                return False
        
        return True
    
    def reserve_tokens(self, params: dict) -> bool:
        """
        Check that the tokens for this request won't go over the token nor
        request limit (per minute). Return a bool to reflect whether the
        tokens were successfully reserved.
        """

        # If a minute has passed, reset the token counts
        cur_time = time.time()
        for model in self.usage.keys():
            if cur_time - self.usage[model]["last_reset_time"] >= 60:
                self.usage[model]["tokens_used"] = 0
                self.usage[model]["requests_made"] = 0
                self.usage[model]["last_reset_time"] = cur_time

        # Get the tokens for this request
        model = params["model"]
        messages = params["messages"]
        num_tokens = OpenAICallManager.num_tokens_from_messages(messages, model)

        # Check if request or token limits would be exceeded
        if (
            self.usage[model]["requests_made"] + 1 > self.limits[model]["RPM"] or
            self.usage[model]["tokens_used"] + num_tokens > self.limits[model]["TPM"]
        ):
            return False
        
        # Reserve request and tokens
        self.usage[model]["requests_made"] += 1
        self.usage[model]["tokens_used"] += num_tokens
        return True

    def call_sync(
        self,
        request_list: list[dict], # list of params for OpenAI request
        return_type: str = "string",
        logger: logging.LoggerAdapter = logger
    ) -> list:
        """
        Takes in a list of dicts with parameter to make a series of OpenAI API
        requests and returns a list with all the responses in the same order.
        Runs the requests concurrently in a ThreadPoolExecutor.

        Note that we don't measure usage here because threading with 16
        workers is already quite slow and doesn't go near the rate limit.

        Here are some common parameters (not comprehensive):

            model=model,
            messages=messages,
            tools=fn,
            tool_choice={"type": "function", "function": {"name": fn_name}},
            response_format={"type": "json_object"},
            seed=123456,
            temperature=temperature,
            max_tokens=max_tokens

        """

        if not self.requests_are_under_token_limit(request_list):
            raise Exception("Token limit exceeded") # TODO: handle this case

        completed_requests = 0
        total_requests = len(request_list)
        results = [None] * total_requests

        with ThreadPoolExecutor(max_workers=16) as executor:
            futures = [
                executor.submit(
                    self.__request_sync,
                    id,
                    params,
                    return_type,
                    logger
                )
                for id, params in enumerate(request_list)
            ]

            for future in as_completed(futures):
                id, result = future.result() # TODO: handle exceptions here?
                results[id] = result
                completed_requests += 1
                logger.info(f"Completed {completed_requests}/{total_requests} OpenAI API requests")
        
        return results

    async def call_async(
        self,
        request_list: list[dict], # list of params for OpenAI request
        return_type: str = "string",
        logger: logging.LoggerAdapter = logger,
        num_workers: int = 200
    ) -> list:
        """
        Takes in a list of dicts with parameter to make a series of OpenAI API
        requests and returns a list with all the responses in the same order.
        Runs these requests concurrently in the event loop for higher
        efficiency.
        """

        # Ensure all param dicts are within token limit
        if not self.requests_are_under_token_limit(request_list):
            raise Exception("Token limit exceeded") # TODO: handle this case
        
        # Wrap each task with a loop that idles until tokens can be reserved
        async def request_when_ready(params: dict):
            """
            Wraps the async request in a check for token reservation. If the
            reservation fails, it waits and retries.
            """
            while not self.reserve_tokens(params):
                logger.warning("OpenAI request rate is at capacity, waiting to retry...") # TODO: remove?
                await asyncio.sleep(10.0)  # Wait before retrying
                logger.debug("Retrying token reservation...")

            return await self.__request_async(
                params=params,
                return_type=return_type,
                logger=logger
            )

        # Run the tasks with AsyncTaskManager
        tasks = [request_when_ready(params) for params in request_list]
        results = await AsyncTaskManager.collect_all(
            tasks=tasks,
            num_workers=num_workers,
            logger=logger,
            log_message_prefix="Completed OpenAI request"
        )
        
        return results

    def __request_sync(
        self,
        id: int,
        params: dict,
        return_type: str,
        logger: logging.LoggerAdapter,
        retries: int = 5,
        retry_wait_time: float = 5.0
    ) -> tuple[int, str | dict | None]:
        """
        Send a synchronous request to OpenAI.
        """

        result = None

        # Attempt OpenAI request with retries
        for i in range(retries):
            try:
                # Make the request
                response = self.gpt_client_sync.chat.completions.create(
                    **params
                )

                if return_type == "string":
                    result = response.choices[0].message.content
                elif return_type == "function":
                    result = json.loads(
                        response.choices[0].message.tool_calls[0].function.arguments
                    )
                else:
                    result = response
                
                return result

            except json.decoder.JSONDecodeError as e:
                if i == retries - 1:
                    logger.error(
                        "Cannot parse OpenAI function call response as JSON: %s",
                        response.choices[0].message.tool_calls[0].function.arguments
                    )
                    raise e
                
                # JSON response was cut off (probably due to repetitive seq)
                # so we increase the frequency penalty to discourage such seqs
                params["frequency_penalty"] = (i + 1.0) / retries
                
                logger.warning(
                    "Cannot parse OpenAI function call response; resending request"
                )
                
            except Exception as e:
                if i == retries - 1:
                    logger.error(
                        "Call to OpenAI failed due to: %s",
                        str(e)
                    )
                    raise e
                
                if "limit" in str(e).lower():
                    # This will probably never happen
                    logger.error("OPENAI RATE LIMIT EXCEPTION: %s", str(e))
                
                logger.warning(
                    "Call to OpenAI failed; retrying in %f seconds",
                    retry_wait_time
                )
                time.sleep(retry_wait_time)

        return (id, result)

    async def __request_async(
        self,
        params: dict,
        return_type: str,
        logger: logging.LoggerAdapter,
        retries: int = 5,
        retry_wait_time: float = 2.0
    ) -> str | dict | None:
        """
        Send an async request to OpenAI.
        """

        result = None

        # Attempt OpenAI request with retries
        for i in range(retries):
            try:
                # Make the request
                response = await self.gpt_client_async.chat.completions.create(
                    **params
                )

                if return_type == "string":
                    result = response.choices[0].message.content
                elif return_type == "function":
                    result = json.loads(
                        response.choices[0].message.tool_calls[0].function.arguments
                    )
                else:
                    result = response

                return result

            except json.decoder.JSONDecodeError as e:
                if i == retries - 1:
                    logger.error(
                        "Cannot parse OpenAI function call response as JSON: %s",
                        response.choices[0].message.tool_calls[0].function.arguments
                    )
                    raise e
                
                # JSON response was cut off (probably due to repetitive seq)
                # so we increase the frequency penalty to discourage such seqs
                params["frequency_penalty"] = (i + 1.0) / retries
                
                logger.warning(
                    "Cannot parse OpenAI function call response; resending request with frequency penalty %f",
                    params["frequency_penalty"]
                )
                
            except Exception as e:
                if i == retries - 1:
                    logger.error(
                        "Call to OpenAI failed due to: %s",
                        str(e)
                    )
                    raise e
                
                if "limit" in str(e).lower():
                    # This will probably never happen
                    logger.error("OPENAI RATE LIMIT EXCEPTION: %s", str(e))
                
                logger.warning(
                    "Call to OpenAI failed; retrying in %f seconds",
                    retry_wait_time
                )
                time.sleep(retry_wait_time)

        return result
