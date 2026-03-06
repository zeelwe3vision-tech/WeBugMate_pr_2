from fastapi import WebSocket


async def stream_response(websocket: WebSocket, stream):
    """
    Generic streaming handler for all chat types.
    Works for both streaming and non-stream responses.
    """

    # 🔹 Non-stream response (normal dict)
    if not hasattr(stream, "__aiter__"):
        # 1. Send text content first
        await websocket.send_json({
            "type": "token",
            "content": stream.get("reply", "No reply")
        })

        # 2. Send metadata (id, chat_id, suggestions) in a 'meta' frame
        # Standardize message_ids from different backend formats
        msg_ids = stream.get("message_ids", {})
        if not msg_ids and "message_id" in stream:
            msg_ids = {"assistant": stream["message_id"]}

        meta_frame = {
            "type": "meta",
            "chat_id": stream.get("chat_id"),
            "message_ids": msg_ids,
            "clarifications": stream.get("clarifications") or stream.get("suggestions"),
            "multi_clarification": stream.get("multi_clarification", False)
        }
        await websocket.send_json(meta_frame)

        # 3. Signal completion
        await websocket.send_json({"type": "done"})
        return

    # 🔹 Streaming response
    async for chunk in stream:
        if isinstance(chunk, dict):
            await websocket.send_json(chunk)
        else:
            await websocket.send_json({
                "type": "token",
                "content": chunk
            })

    await websocket.send_json({"type": "done"})