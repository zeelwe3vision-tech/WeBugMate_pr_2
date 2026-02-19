from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from pipeline.pipeline import insert, update

router = APIRouter(prefix="/records", tags=["Records"])

@router.post("/insert/{table_name}")
async def insert_data(table_name: str, payload: Dict[str, Any]):
    try:
        result = insert(table_name, payload)
        return {"success": True, "data": result.data}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # except Exception:
    #     raise HTTPException(status_code=500, detail="Internal Server Error")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.patch("/update/{table_name}/{record_id}")
async def update_data(table_name: str, record_id: str, payload: Dict[str, Any]):
    try:
        result = update(table_name, record_id, payload)
        return {"success": True, "data": result.data}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except Exception:
        raise HTTPException(status_code=500, detail="Internal Server Error")
