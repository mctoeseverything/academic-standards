# Academic Standards Board

Academic Standards Board (ASB) is a full-stack standardized testing and assessment platform built on top of the existing vanilla HTML/CSS/JS exam engine in this repository. It adds:

- Express + PostgreSQL backend
- JWT auth in `httpOnly` cookies
- student and teacher dashboards
- course, question bank, test, roster, and results workflows
- API-backed exam delivery using the existing `script.js` renderer

## Stack

- Frontend: vanilla HTML/CSS/JS
- Backend: Node.js + Express
- Database: PostgreSQL
- Auth: JWT in cookies

## Project Structure

```text
.
├── assets/
├── asb-secure-exam/
├── db/
│   ├── schema.sql
│   └── seed.sql
├── pages/
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── shared.css
│   ├── shared.js
│   ├── student/
│   │   ├── courses.html
│   │   ├── dashboard.html
│   │   ├── history.html
│   │   └── results.html
│   └── teacher/
│       ├── course-detail.html
│       ├── courses.html
│       ├── dashboard.html
│       ├── question-bank.html
│       ├── students.html
│       ├── test-results.html
│       └── tests.html
├── server/
│   ├── app.js
│   ├── config.js
│   ├── db.js
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── student.js
│   │   └── teacher.js
│   └── services/
│       ├── grade.js
│       └── tests.js
├── .env.example
├── index.html
├── main.js
├── package.json
├── preload.js
├── questions.json
├── script.js
└── style.css
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your environment file:

```bash
copy .env.example .env
```

3. Create a PostgreSQL database named `asb`.

4. Initialize the schema:

```bash
psql -U postgres -d asb -f db/schema.sql
```

5. Seed sample data:

```bash
psql -U postgres -d asb -f db/seed.sql
```

6. Start the server:

```bash
npm start
```

7. Open:

- [http://localhost:3000](http://localhost:3000)
- Student dashboard after login: `/student/dashboard`
- Teacher dashboard after login: `/teacher/dashboard`

## Demo Accounts

The sample seed uses the same bcrypt hash for every seeded account.

- Password for all demo accounts: `Password123!`

Teachers:

- `alicia.monroe@asb-demo.edu`
- `daniel.carter@asb-demo.edu`

Students:

- `amara.patel@student.asb-demo.edu`
- `julian.brooks@student.asb-demo.edu`
- `maya.nguyen@student.asb-demo.edu`
- `noah.bennett@student.asb-demo.edu`
- `olivia.reed@student.asb-demo.edu`
- `isaac.flores@student.asb-demo.edu`
- `leah.kim@student.asb-demo.edu`
- `ethan.ross@student.asb-demo.edu`
- `sofia.hernandez@student.asb-demo.edu`
- `caleb.price@student.asb-demo.edu`

## Notes

- The original exam renderer remains in `index.html`, `style.css`, and `script.js`.
- `/student/test/:id` serves that exam UI with API-backed question loading and attempt persistence.
- The seed question bank is sourced from the existing `questions.json` set and shaped into database-backed tests.
- Charts are rendered with inline SVG only.
