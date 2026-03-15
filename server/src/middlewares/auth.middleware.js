import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import { config } from "../config/env.js";

class AuthMiddleware {
  /**
   * Protects routes by verifying the HttpOnly cookie token
   */
  static protect(req, res, next) {
    // 1. Get token from cookies
    const token = req.cookies.token;

    if (!token) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ 
        error: "Access denied. No token provided." 
      });
    }

    try {
      // 2. Verify the token
      const decoded = jwt.verify(token, config.jwtSecret || 'supersecretkey');
      
      // 3. Attach user info to request object
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(StatusCodes.FORBIDDEN).json({ 
        error: "Invalid or expired token." 
      });
    }
  }

  /**
   * Optional: Admin check middleware
   */
  static checkRole(req, res, next) {
    if (req.user && req.user.isAdmin) {
      next();
    } else {
      return res.status(StatusCodes.FORBIDDEN).json({ 
        error: "Access denied. Admin only." 
      });
    }
  }
}

export default AuthMiddleware