-- CreateTable
CREATE TABLE "Lottery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "winnerCount" INTEGER NOT NULL,
    "deadline" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "drawnAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lottery_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lottery_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LotteryEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lotteryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LotteryEntry_lotteryId_fkey" FOREIGN KEY ("lotteryId") REFERENCES "Lottery" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LotteryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LotteryWinner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lotteryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LotteryWinner_lotteryId_fkey" FOREIGN KEY ("lotteryId") REFERENCES "Lottery" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LotteryWinner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Lottery_conversationId_idx" ON "Lottery"("conversationId");

-- CreateIndex
CREATE INDEX "Lottery_status_deadline_idx" ON "Lottery"("status", "deadline");

-- CreateIndex
CREATE UNIQUE INDEX "LotteryEntry_lotteryId_userId_key" ON "LotteryEntry"("lotteryId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LotteryWinner_lotteryId_userId_key" ON "LotteryWinner"("lotteryId", "userId");
