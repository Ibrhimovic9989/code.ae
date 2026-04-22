-- CreateTable
CREATE TABLE "SupabaseIntegration" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "accessToken" TEXT NOT NULL,
    "supabaseEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupabaseIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupabaseIntegration_userId_key" ON "SupabaseIntegration"("userId");

-- AddForeignKey
ALTER TABLE "SupabaseIntegration" ADD CONSTRAINT "SupabaseIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "supabaseProjectRef" TEXT;
