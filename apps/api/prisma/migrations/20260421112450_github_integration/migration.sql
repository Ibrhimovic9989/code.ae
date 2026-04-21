-- CreateTable
CREATE TABLE "GitHubIntegration" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "githubLogin" TEXT NOT NULL,
    "githubId" INTEGER NOT NULL,
    "accessToken" TEXT NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT 'repo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GitHubIntegration_userId_key" ON "GitHubIntegration"("userId");

-- AddForeignKey
ALTER TABLE "GitHubIntegration" ADD CONSTRAINT "GitHubIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
