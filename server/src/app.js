import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import cookieParser from 'cookie-parser';


const app = express();

// Global Middlewares
app.use(helmet());           // Security headers
app.use(cors());             // Enable CORS
app.use(express.json());     // Parse incoming JSON requests
app.use(cookieParser());
// Define Main Router
app.get("/ping",(req,res)=>{
    res.json({
        message:"ping"
    })
})
app.use('/api', routes);

// Handling non-existent routes (404)
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

export default app;
