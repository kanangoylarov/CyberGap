import { StatusCodes } from "http-status-codes";
import { PrismaClient } from "@prisma/client";
import { config } from "../config/env.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

class AuthController {
  static async signup(req, res) {
    try {
      const { firstName, lastName, email, password, company } = req.body;

      const userExists = await prisma.user.findUnique({ where: { email } });

      if (userExists) {
        // StatusCodes.CONFLICT (409)
        return res
          .status(StatusCodes.CONFLICT)
          .json({ error: "User already exists." });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await prisma.user.create({
        data: { firstName, lastName, email, password: hashedPassword, company },
      });

      const { password: _, ...userData } = newUser;

      // StatusCodes.CREATED (201)
      return res.status(StatusCodes.CREATED).json({
        message: "Registration successful!",
        user: userData,
      });
    } catch (error) {
      // StatusCodes.INTERNAL_SERVER_ERROR (500)
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "Internal server error.",
      });
    }
  }
  static async signin(req, res) {
    try {
      const { email, password } = req.body;

      // 1. Check if the user exists in the database
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res
          .status(StatusCodes.UNAUTHORIZED)
          .json({ error: "Invalid email or password." });
      }

      // 2. Compare the provided password with the hashed password in the DB
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res
          .status(StatusCodes.UNAUTHORIZED)
          .json({ error: "Invalid email or password." });
      }

      // 3. Generate a JWT token for the session
      const token = jwt.sign(
        { userId: user.id, email: user.email, isAdmin: user.isAdmin },
        config.jwtSecret || "supersecretkey",
        { expiresIn: "1h" },
      );
      res.cookie("token", token, {
        httpOnly: true, // Prevents JavaScript from accessing the cookie
        secure: config.nodeEnv === "production", // Only send over HTTPS in production
        sameSite: "strict", // Protects against CSRF
        maxAge: 3600000, // 1 hour in milliseconds
      });

      // 4. Return the token and user info to the client
      return res.status(StatusCodes.OK).json({
        message: "Login successful!",
        token,
      });
    } catch (error) {
      // 5. Handle unexpected server errors
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "Internal server error.",
      });
    }
  }
  static async signout(req, res) {
    try {
      // 1. Clear the cookie named 'token'
      res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });

      // 2. Return a success message
      return res.status(StatusCodes.OK).json({
        message: "Successfully signed out!",
      });
    } catch (error) {
      // 3. Handle unexpected server errors
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "Internal server error during logout.",
      });
    }
  }
  static async getRole(req, res) {
    try {
      // 1. Ensure user is authenticated (middleware ensures req.user exists)
      if (!req.user) {
        return res.status(StatusCodes.UNAUTHORIZED).json({
          error: "User not authenticated.",
        });
      }
      console.log(req.user.isAdmin);

      // 2. Return role-related info from the JWT payload
      return res.status(StatusCodes.OK).json({
        role: req.user.isAdmin ? "admin" : "user",
      });
    } catch (error) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "Internal server error.",
      });
    }
  }
  static async getAllUsers(req, res) {
    try {
      const { page = 1, limit = 10, search = "" } = req.query;

      // 1. Calculate skip (offset)
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);

      // 2. Define search criteria
      // 1. Start with the base filter that excludes admins
      let where = {
        NOT: { isAdmin: true },
      };

      // 2. If a search query exists, add the OR condition within the same object
      if (search) {
        where = {
          ...where, // Keeps the NOT { isAdmin: true }
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        };
      }

      // 3. Fetch data and total count in parallel
      const [users, totalCount] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: "desc" },
        }),
        prisma.user.count({ where }),
      ]);

      return res.status(StatusCodes.OK).json({
        data: users,
        meta: {
          total: totalCount,
          page: parseInt(page),
          limit: take,
          totalPages: Math.ceil(totalCount / take),
        },
      });
    } catch (error) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "Internal server error.",
      });
    }
  }
}

export default AuthController;
