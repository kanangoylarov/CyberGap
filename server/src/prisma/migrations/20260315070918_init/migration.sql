-- AddForeignKey
ALTER TABLE "audit_responses" ADD CONSTRAINT "audit_responses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
