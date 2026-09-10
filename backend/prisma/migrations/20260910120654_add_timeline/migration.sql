-- CreateTable
CREATE TABLE "Timeline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "creatorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Timeline_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimelineParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timelineId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimelineParticipant_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "Timeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimelineParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimelineBranch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timelineId" TEXT NOT NULL,
    "ownerId" TEXT,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimelineBranch_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "Timeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimelineBranch_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimelineFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimelineFile_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "TimelineBranch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimelineFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MergeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timelineId" TEXT NOT NULL,
    "sourceBranchId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mergedAt" DATETIME,
    "mergedById" TEXT,
    "resubmitCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "MergeRequest_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "Timeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MergeRequest_sourceBranchId_fkey" FOREIGN KEY ("sourceBranchId") REFERENCES "TimelineBranch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MergeRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MergeRequest_mergedById_fkey" FOREIGN KEY ("mergedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MergeRequestVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mergeRequestId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MergeRequestVote_mergeRequestId_fkey" FOREIGN KEY ("mergeRequestId") REFERENCES "MergeRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MergeRequestVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MergeRequestComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mergeRequestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MergeRequestComment_mergeRequestId_fkey" FOREIGN KEY ("mergeRequestId") REFERENCES "MergeRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MergeRequestComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimelineActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timelineId" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimelineActivity_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "Timeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimelineActivity_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "TimelineBranch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimelineActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Timeline_creatorId_idx" ON "Timeline"("creatorId");

-- CreateIndex
CREATE INDEX "Timeline_status_idx" ON "Timeline"("status");

-- CreateIndex
CREATE INDEX "TimelineParticipant_userId_idx" ON "TimelineParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TimelineParticipant_timelineId_userId_key" ON "TimelineParticipant"("timelineId", "userId");

-- CreateIndex
CREATE INDEX "TimelineBranch_timelineId_idx" ON "TimelineBranch"("timelineId");

-- CreateIndex
CREATE INDEX "TimelineBranch_ownerId_idx" ON "TimelineBranch"("ownerId");

-- CreateIndex
CREATE INDEX "TimelineFile_branchId_idx" ON "TimelineFile"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "TimelineFile_branchId_filename_version_key" ON "TimelineFile"("branchId", "filename", "version");

-- CreateIndex
CREATE INDEX "MergeRequest_timelineId_status_idx" ON "MergeRequest"("timelineId", "status");

-- CreateIndex
CREATE INDEX "MergeRequest_sourceBranchId_idx" ON "MergeRequest"("sourceBranchId");

-- CreateIndex
CREATE INDEX "MergeRequestVote_mergeRequestId_idx" ON "MergeRequestVote"("mergeRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "MergeRequestVote_mergeRequestId_voterId_key" ON "MergeRequestVote"("mergeRequestId", "voterId");

-- CreateIndex
CREATE INDEX "MergeRequestComment_mergeRequestId_idx" ON "MergeRequestComment"("mergeRequestId");

-- CreateIndex
CREATE INDEX "TimelineActivity_timelineId_createdAt_idx" ON "TimelineActivity"("timelineId", "createdAt");
