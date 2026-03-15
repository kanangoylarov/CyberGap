# Production Node.js Backend Setup

A production-ready Node.js backend using Express.js, PostgreSQL (via Supabase), and Prisma ORM following clean architecture principles.

## 🚀 Tech Stack

- **Node.js**: Runtime environment
- **Express.js**: Minimalist web framework
- **PostgreSQL**: Relational database (hosted on Supabase)
- **Prisma**: Next-generation Node.js and TypeScript ORM
- **ES Modules**: Modern JavaScript syntax (`type: module`)

## 📁 Project Structure (Clean Architecture)

```text
src/
  ├── config/        # Environment and configuration variables
  ├── controllers/   # Route handlers logic
  ├── middlewares/   # Custom Express middlewares (error handling, auth, etc.)
  ├── prisma/        # Prisma schema and client instantiation
  ├── routes/        # Express route definitions
  ├── services/      # Business logic and database interactions
  ├── utils/         # Reusable utilities (like loggers)
  └── server.js      # Application entry point
```

## 🛠️ Setup Instructions

### 1. Install Dependencies

Install all basic app dependencies including dev dependencies:

```bash
npm install
```

### 2. Environment Variables Configuration

The project uses `dotenv` to manage environment variables. Provide your Supabase / PostgreSQL credentials in a `.env` file at the root.

Rename `.env.example` to `.env` and fill it out:

```env
PORT=3000
DATABASE_URL="postgres://postgres:[PASSWORD]@[HOST]:6543/postgres?pgbouncer=true"
DIRECT_URL="postgres://postgres:[PASSWORD]@[HOST]:5432/postgres" # Direct connection for migrations
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_KEY="your-supabase-anon-key"
```
> **Note on Prisma with Supabase:** Ensure that `DATABASE_URL` is using connection pooling (port `6543` and `pgbouncer=true`) while the `directUrl` in your `schema.prisma` points to port `5432` for seamless migrations.

### 3. Database Migration

Sync your Prisma schema with the Supabase PostgreSQL database. This step creates the initial models.
```bash
npm run prisma:migrate
```

### 4. Prisma Client Generation

Generate Prisma Client to interact with your DB in the code:
```bash
npm run prisma:generate
```

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the server in development mode using `nodemon` for auto-restart |
| `npm run start` | Starts the server for production |
| `npm run build` | Placeholder script for build processes |
| `npm run prisma:migrate` | Runs database migrations |
| `npm run prisma:generate` | Generates the Prisma ORM client |

## 🌐 API Endpoints

### Health Check

```http
GET /health
```
**Response:**
```json
{
  "status": "ok"
}
```

## 🔒 Security

- `helmet` is configured by default for setting various secure HTTP headers.
- `cors` is enabled for cross-origin access protection.
