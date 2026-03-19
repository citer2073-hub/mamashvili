# 🇬🇪 Мамашвили — Грузинский ресторан

React + TypeScript + Firebase (Auth, Realtime DB, Storage, Hosting).

---

## 🚀 Деплой на Firebase Hosting

### Шаг 1 — Установить зависимости
```bash
npm install
```

### Шаг 2 — Собрать production-билд
```bash
npm run build
```
Появится папка `/build` — это готовый сайт.

### Шаг 3 — Деплой
```bash
# Установить Firebase CLI (один раз глобально)
npm install -g firebase-tools

# Войти в аккаунт Google
firebase login

# Задеплоить (проект mamashvili-4d361 уже прописан в .firebaserc)
firebase deploy --only hosting
```

Сайт будет доступен по адресу: **https://mamashvili-4d361.web.app**

---

## 💻 Локальная разработка

```bash
npm start          # http://localhost:3000
```

Тест хостинга локально:
```bash
npm run build && firebase serve --only hosting
# http://localhost:5000
```

---

## 📁 Структура
```
mamashvili/
├── public/
│   ├── index.html       ← HTML-шаблон
│   └── manifest.json    ← PWA манифест
├── src/
│   ├── index.tsx        ← Точка входа React
│   └── App.tsx          ← Всё приложение
├── .firebaserc          ← Привязка к проекту mamashvili-4d361
├── firebase.json        ← Хостинг: SPA routing + кэш + заголовки
├── .env.example         ← Шаблон переменных окружения
├── package.json
└── tsconfig.json
```
