-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "vercelDeploymentUrl" TEXT,
ADD COLUMN     "vercelProjectId" TEXT;

-- CreateTable
CREATE TABLE "VercelIntegration" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "accessToken" TEXT NOT NULL,
    "vercelUserId" TEXT NOT NULL,
    "vercelUsername" TEXT NOT NULL,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VercelIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VercelIntegration_userId_key" ON "VercelIntegration"("userId");

-- AddForeignKey
ALTER TABLE "VercelIntegration" ADD CONSTRAINT "VercelIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
