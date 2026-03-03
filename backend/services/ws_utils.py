from fastapi import WebSocket


async def stream_response(websocket: WebSocket, stream):
    """
    Generic streaming handler for all chat types.
    Works for both streaming and non-stream responses.
    """

    # 🔹 Non-stream response (normal dict)
    if not hasattr(stream, "__aiter__"):
        await websocket.send_json({
            "type": "token",
            "content": stream.get("reply", "No reply")
        })

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