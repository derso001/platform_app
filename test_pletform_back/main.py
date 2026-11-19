import os
import jwt
import datetime
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from dotenv import load_dotenv

from database import engine, Base, get_db
from models import TestDB, UserDB

load_dotenv()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
JWT_SECRET = os.getenv("JWT_SECRET", "fallback-secret-key-change-me")
JWT_ALGORITHM = "HS256"

app = FastAPI(title="OS Explorer Test Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic-схеми
class TestCreate(BaseModel):
    meta: dict
    modules: list

class GoogleAuthRequest(BaseModel):
    credential: str

# Допоміжні функції авторизації
def create_access_token(user_id: str, email: str):
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=14)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(authorization: str = Header(None), db: AsyncSession = Depends(get_db)) -> UserDB:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Не авторизовано")
    
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        result = await db.execute(select(UserDB).where(UserDB.id == user_id))
        user = result.scalars().first()
        if not user:
            raise HTTPException(status_code=401, detail="Користувача не знайдено")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Сесія закінчилася. Увійдіть знову.")
    except Exception:
        raise HTTPException(status_code=401, detail="Невалідний токен")

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# 0. АВТОРИЗАЦІЯ ЧЕРЕЗ GOOGLE
@app.post("/api/auth/google")
async def auth_google(auth_data: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    try:
        idinfo = id_token.verify_oauth2_token(
            auth_data.credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
        email = idinfo["email"]
        full_name = idinfo.get("name", email.split("@")[0])
        avatar_url = idinfo.get("picture", "")

        result = await db.execute(select(UserDB).where(UserDB.email == email))
        user = result.scalars().first()

        if not user:
            user = UserDB(email=email, full_name=full_name, avatar_url=avatar_url)
            db.add(user)
            await db.commit()
            await db.refresh(user)
        else:
            user.full_name = full_name
            user.avatar_url = avatar_url
            await db.commit()

        token = create_access_token(user.id, user.email)
        return {
            "status": "success",
            "token": token,
            "user": {
                "id": user.id,
                "name": user.full_name,
                "email": user.email,
                "avatar": user.avatar_url
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Помилка перевірки Google токена: {str(e)}")

# 1. ЗБЕРЕГТИ НОВИЙ ТЕСТ (Тільки авторизований вчитель)
@app.post("/api/tests/")
async def create_test(
    test_data: TestCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: UserDB = Depends(get_current_user)
):
    new_test = TestDB(
        teacher_id=current_user.id,
        meta_data=test_data.meta,
        modules=test_data.modules
    )
    db.add(new_test)
    await db.commit()
    await db.refresh(new_test)
    return {"status": "success", "test_id": new_test.id}

# 2. ОТРИМАТИ ТЕСТ (Для проходження учнем — без авторизації + повертаємо автора)
@app.get("/api/tests/{test_id}")
async def get_test(test_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TestDB).options(selectinload(TestDB.author)).where(TestDB.id == test_id)
    )
    test = result.scalars().first()
    
    if not test:
        raise HTTPException(status_code=404, detail="Тест не знайдено")
        
    return {
        "status": "success", 
        "data": {
            "meta": test.meta_data,
            "modules": test.modules,
            "author": {
                "name": test.author.full_name if test.author else "Викладач",
                "avatar": test.author.avatar_url if test.author else None
            }
        }
    }

# 3. ОТРИМАТИ ТЕСТИ ПОТОЧНОГО ВЧИТЕЛЯ (Для панелі керування)
@app.get("/api/tests/")
async def get_all_tests(
    db: AsyncSession = Depends(get_db), 
    current_user: UserDB = Depends(get_current_user)
):
    result = await db.execute(
        select(TestDB)
        .where(TestDB.teacher_id == current_user.id)
        .order_by(TestDB.created_at.desc())
    )
    tests = result.scalars().all()
    
    return {
        "status": "success",
        "data": [
            {
                "id": t.id,
                "created_at": t.created_at,
                "meta": t.meta_data,
            } for t in tests
        ]
    }

# 4. ОНОВИТИ ТЕСТ (Тільки автор тесту)
@app.put("/api/tests/{test_id}")
async def update_test(
    test_id: str, 
    test_data: TestCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: UserDB = Depends(get_current_user)
):
    result = await db.execute(select(TestDB).where(TestDB.id == test_id))
    test = result.scalars().first()
    
    if not test:
        raise HTTPException(status_code=404, detail="Тест не знайдено")
    if test.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Ви не можете редагувати чужий тест")
        
    test.meta_data = test_data.meta
    test.modules = test_data.modules
    
    await db.commit()
    return {"status": "success", "message": "Тест успішно оновлено"}

# 5. ВИДАЛИТИ ТЕСТ (Тільки автор тесту)
@app.delete("/api/tests/{test_id}")
async def delete_test(
    test_id: str, 
    db: AsyncSession = Depends(get_db), 
    current_user: UserDB = Depends(get_current_user)
):
    result = await db.execute(select(TestDB).where(TestDB.id == test_id))
    test = result.scalars().first()
    
    if not test:
        raise HTTPException(status_code=404, detail="Тест не знайдено")
    if test.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Ви не можете видалити чужий тест")
        
    await db.delete(test)
    await db.commit()
    return {"status": "success", "message": "Тест видалено"}