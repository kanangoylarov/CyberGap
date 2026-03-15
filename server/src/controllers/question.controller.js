import { PrismaClient } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';

const prisma = new PrismaClient();

class QuestionController {
  
  // 1. Create a question
  static async create(req, res) {
    try {
      const { standardName, category, clauseNumber, questionText } = req.body;
      console.log(req.body);
      
      const question = await prisma.question.create({
        data: { standardName, category, clauseNumber, questionText }
      });

      return res.status(StatusCodes.CREATED).json(question);
    } catch (error) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Failed to create question." });
    }
  }

  // 2. Delete a question
  static async delete(req, res) {
    try {
      const { id } = req.params;
      await prisma.question.delete({ where: { id: parseInt(id) } });
      return res.status(StatusCodes.OK).json({ message: "Question deleted successfully." });
    } catch (error) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Failed to delete question." });
    }
  }

  // 3. Update a question
  static async update(req, res) {
    try {
      const { id } = req.params;
      const data = req.body;
      const updated = await prisma.question.update({
        where: { id: parseInt(id) },
        data
      });
      return res.status(StatusCodes.OK).json(updated);
    } catch (error) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Failed to update question." });
    }
  }

  // 4. Get all questions grouped by category (for assessment wizard)
  static async getAllGrouped(req, res) {
    try {
      const userId = req.user.userId;

      const [questions, responses] = await Promise.all([
        prisma.question.findMany({ orderBy: [{ category: 'asc' }, { clauseNumber: 'asc' }] }),
        prisma.auditResponse.findMany({
          where: { userId },
          select: { questionId: true, answer: true }
        })
      ]);

      // Group by category
      const categories = {};
      for (const q of questions) {
        const cat = q.category || 'Uncategorized';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(q);
      }

      // Build existing answers map
      const existingAnswers = {};
      for (const r of responses) {
        existingAnswers[r.questionId] = r.answer;
      }

      return res.status(StatusCodes.OK).json({ categories, existingAnswers });
    } catch (error) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Failed to fetch grouped questions." });
    }
  }

  // 5. Get questions with Search, Filter & Pagination
  static async getQuestions(req, res) {
    try {
      const { search, category, standard, page = 1, limit = 10 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Dynamic filtering
      const where = {
        ...(search && { questionText: { contains: search, mode: 'insensitive' } }),
        ...(category && { category }),
        ...(standard && { standardName: standard }),
      };

      const [questions, total] = await Promise.all([
        prisma.question.findMany({ where, skip, take: parseInt(limit) }),
        prisma.question.count({ where })
      ]);

      return res.status(StatusCodes.OK).json({ data: questions, meta: { total, page: parseInt(page) } });
    } catch (error) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Failed to fetch questions." });
    }
  }
}

export default QuestionController