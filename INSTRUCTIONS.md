# Онко-ГИС: Инструкция по развёртыванию

## Требования

- Python 3.11+
- Git
- Браузер (Chrome / Firefox / Edge)

---

## 1. Первая публикация на GitHub (один раз, на рабочей машине)

```bash
cd f:\Сделано\Аналитика\Webapp

git init
git add .
git commit -m "initial"
git remote add origin https://github.com/<ваш-аккаунт>/<репозиторий>.git
git branch -M main
git push -u origin main
```

> Файлы `raws/*.xlsx` и `raws/*.docx` **не попадут** в репозиторий (`.gitignore`).
> Передавайте их отдельно: флешка, зашифрованный архив, защищённый файлообменник.

---

## 2. Установка на новой машине

```bash
git clone https://github.com/<ваш-аккаунт>/<репозиторий>.git
cd <папка>
pip install -r backend/requirements.txt
```

---

## 3. Разместить сырые данные

Скопировать вручную в папку `raws/`:

| Файл | Назначение |
|------|-----------|
| `координаты МО бн.xlsx` | Список МО с координатами |
| `РМЖ (1)бн.xlsx` | Скрининг рака молочной железы |
| `КРР (1)бн.xlsx` | Скрининг колоректального рака |
| `РШМ (1)бн.xlsx` | Скрининг рака шейки матки |
| `epidemiology.xlsx` | Эпидемиологические показатели (опционально) |

---

## 4. Обработать данные

```bash
python scripts/process_screening.py
python scripts/process_epidemiology.py   # если есть epidemiology.xlsx
```

Результат — JSON-файлы в `frontend/public/`:
`screening_rmzh.json`, `screening_krr.json`, `screening_rshm.json`,
`mos.json`, `meta.json`, `epidemiology.json`

---

## 5. Запустить сервер

```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8080 --reload
```

**Если порт 8080 занят** — попробуйте 8090, 5000 или 3000:

```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8090 --reload
```

> Никогда не запускайте через `--host 0.0.0.0` на рабочей станции в сети больницы —
> это откроет доступ всем устройствам в сети без аутентификации.

---

## 6. Открыть в браузере

```
http://localhost:8080/app.html
```

---

## 7. Современный frontend для локальной разработки (опционально)

```bash
cd frontend
npm install
npm run dev
```

Открыть:

```
http://localhost:5173
```

> В этом режиме backend должен быть запущен локально на `http://localhost:8080`.

---

## 8. Docker Compose (опционально)

```bash
docker compose up --build
```

После запуска:

- frontend: `http://localhost`
- backend API: `http://localhost:8000`

---

## 9. Обновление данных без перезапуска сервера

**Через веб-интерфейс (AdminPanel):**

1. Нажать кнопку **⚙ Данные** (правый верхний угол)
2. Ввести пароль: `admin2024`
3. Вкладка **Скрининг** — загрузить новый XLSX для РМЖ / КРР / РШМ
4. Вкладка **Эпидемиология** — загрузить epidemiology.xlsx

После загрузки скрипт обработки запускается автоматически, данные обновляются на странице.

**Через командную строку:**

```bash
# Скопировать новый файл в raws/
copy "новый_РМЖ.xlsx" "raws/РМЖ (1)бн.xlsx"
python scripts/process_screening.py
```

---

## 10. Смена пароля администратора

```python
import hashlib
print(hashlib.sha256(b"новый_пароль").hexdigest())
```

Задать переменную окружения перед запуском:

```bash
# Windows (PowerShell)
$env:ADMIN_PASSWORD_HASH = "вставить_хеш_сюда"
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8080

# Linux / macOS
ADMIN_PASSWORD_HASH="вставить_хеш_сюда" python -m uvicorn backend.main:app --host 127.0.0.1 --port 8080
```

---

## 11. Структура проекта

```
Webapp/
├── backend/
│   ├── main.py              # FastAPI сервер
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/                 # React/Vite интерфейс
│   ├── Dockerfile
│   ├── package.json
│   └── public/
│       ├── app.html         # HTML-оболочка
│       ├── app.jsx          # Legacy React-код (Babel CDN)
│       ├── abay_districts.geojson
│       └── *.json           # Генерируются скриптами
├── raws/                    # Сырые данные (НЕ в git)
│   └── *.xlsx
├── geodata/                 # Исходные shape-файлы для районов
├── scripts/
│   ├── process_screening.py
│   ├── process_epidemiology.py
│   ├── filter_geodata.py
│   └── requirements.txt
├── docker-compose.yml
├── .gitignore
└── INSTRUCTIONS.md
```

---

## 12. Часто встречаемые ошибки

| Ошибка | Причина | Решение |
|--------|---------|---------|
| `WinError 10013` при запуске | Порт заблокирован Windows или антивирусом | Сменить порт: `--port 8090` |
| `404 — run scripts first` | JSON-файлы не сгенерированы | Запустить `python scripts/process_screening.py` |
| Карта не загружается | Нет интернета (тайлы CartoDB) | Нужен доступ к `basemaps.cartocdn.com` |
| Маркеры МО не отображаются | Выбран год/квартал без данных | Проверить фильтры; проверить meta.json |
| Загрузка XLSX выдаёт 401 | Неверный пароль в AdminPanel | Пароль по умолчанию: `admin2024` |
