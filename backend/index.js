const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "PR Guardian backend is running"
  });
});

app.post("/analyze-pr", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        error: "Pull request URL is required"
      });
    }

    const match = url.match(
      /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/
    );

    if (!match) {
      return res.status(400).json({
        error: "Invalid GitHub pull request URL"
      });
    }

    const owner = match[1];
    const repo = match[2];
    const pullNumber = match[3];

    const prResponse = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`
    );

    const filesResponse = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/files`
    );

    const pr = prResponse.data;
    const files = filesResponse.data;
    const sourceFiles = files.filter((file) =>
  file.filename.endsWith(".js") &&
  !file.filename.includes("test")
);

const testFiles = files.filter((file) =>
  file.filename.includes("test") ||
  file.filename.includes("__tests__")
);

const dependencyFiles = files.filter((file) =>
  file.filename.includes("package.json") ||
  file.filename.includes("package-lock.json")
);

let riskScore = 0;
const riskReasons = [];

if (sourceFiles.length > 0) {
  riskScore += 2;
  riskReasons.push("Production source code was modified.");
}

if (testFiles.length === 0 && sourceFiles.length > 0) {
  riskScore += 3;
  riskReasons.push("Source code changed without corresponding test changes.");
}

if (dependencyFiles.length > 0) {
  riskScore += 1;
  riskReasons.push("Dependency configuration or lock files changed.");
}

let riskLevel = "LOW";

if (riskScore >= 5) {
  riskLevel = "HIGH";
} else if (riskScore >= 3) {
  riskLevel = "MEDIUM";
}

const coverageSignals = [];
if (sourceFiles.length > 0 && testFiles.length === 0) {
  coverageSignals.push("Source code was modified but no test files changed.");
  coverageSignals.push("Consider adding or updating tests for the changed source files.");
} else if (sourceFiles.length > 0 && testFiles.length > 0) {
  coverageSignals.push("Test files were updated alongside source changes.");
} else if (sourceFiles.length === 0 && testFiles.length > 0) {
  coverageSignals.push("Test files changed without any production source changes.");
}

    res.json({
      title: pr.title,
      number: pr.number,
      state: pr.state,
      author: pr.user.login,
      baseBranch: pr.base.ref,
      headBranch: pr.head.ref,
      commits: pr.commits,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,

      classification: {
        sourceFiles: sourceFiles.length,
        testFiles: testFiles.length,
        dependencyFiles: dependencyFiles.length
      },
      
      risk: {
        score: riskScore,
        level: riskLevel,
        reasons: riskReasons
      },

      testCoverageSignals: {
        sourceChanged: sourceFiles.length > 0,
        testsChanged: testFiles.length > 0,
        changedTestFiles: testFiles.map((f) => f.filename),
        signals: coverageSignals
      },

      files: files.map((file) => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch
      }))
    });

  } catch (error) {
    console.error(error.message);

    res.status(500).json({
      error: "Failed to analyze pull request"
    });
  }
});

app.listen(PORT, () => {
  console.log(`PR Guardian backend running on http://localhost:${PORT}`);
});