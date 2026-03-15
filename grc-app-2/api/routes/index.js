const authRoutes = require('./auth.routes');
const questionsRoutes = require('./questions.routes');
const auditRoutes = require('./audit.routes');
const reportsRoutes = require('./reports.routes');

function mountRoutes(app) {
  app.use('/api/auth', authRoutes);
  app.use('/api/questions', questionsRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/reports', reportsRoutes);
}

module.exports = mountRoutes;
