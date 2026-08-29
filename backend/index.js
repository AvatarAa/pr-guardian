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
        error: "Pull request URL is required.",
        code: "MISSING_URL"
      });
    }

    const match = url.match(
      /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/
    );

    if (!match) {
      return res.status(400).json({
        error: "URL does not match a GitHub pull request (expected: github.com/owner/repo/pull/N).",
        code: "INVALID_URL"
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

const reviewFindings = [];

const allTestedValues = new Set();
for (const tf of testFiles) {
  const patch = tf.patch || "";
  for (const line of patch.split("\n")) {
    if (!line.startsWith("+")) continue;
    const m = line.match(/\bquantity\s*:\s*(\d+)/);
    if (m) allTestedValues.add(Number(m[1]));
  }
}
const testedValuesArray = Array.from(allTestedValues).sort((a, b) => a - b);

const boundaryRe = /\b(quantity|price|count|amount|total)\b[^=\n]*([><!]=?)\s*(\d+)/g;

for (const sf of sourceFiles) {
  const patch = sf.patch || "";
  for (const line of patch.split("\n")) {
    if (!line.startsWith("+")) continue;
    boundaryRe.lastIndex = 0;
    let m;
    while ((m = boundaryRe.exec(line)) !== null) {
      const operator = m[2];
      const threshold = Number(m[3]);
      const condition = `${m[1]} ${operator} ${threshold}`;
      let gap = false;
      if ((operator === ">=" || operator === ">") &&
          !testedValuesArray.some((v) => v > threshold)) {
        gap = true;
      }
      if ((operator === "<=" || operator === "<") &&
          !testedValuesArray.some((v) => v < threshold)) {
        gap = true;
      }
      if (gap) {
        reviewFindings.push({
          filename: sf.filename,
          type: "boundary-gap",
          condition,
          threshold,
          testedValues: testedValuesArray,
          recommendation: testedValuesArray.length === 0
            ? `Condition '${condition}' in ${sf.filename} was detected, but no changed tests exercise this boundary at all.`
            : `Condition '${condition}' in ${sf.filename} is only demonstrated at the threshold value (${threshold}). Values beyond the threshold are not exercised by the changed tests.`
        });
      }
    }
  }
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

      reviewFindings,

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
    const status = error.response?.status;
    const rateLimitRemaining = error.response?.headers?.["x-ratelimit-remaining"];
    const isRateLimited = status === 429 || rateLimitRemaining === "0";

    if (status === 404) {
      return res.status(404).json({
        error: "Pull request not found. Check that the repository is public and the PR number is correct.",
        code: "GITHUB_NOT_FOUND"
      });
    }

    if (isRateLimited) {
      return res.status(429).json({
        error: "GitHub API rate limit exceeded. Try again later or provide an authenticated token.",
        code: "GITHUB_RATE_LIMITED"
      });
    }

    if (status === 403) {
      return res.status(403).json({
        error: "GitHub API access denied. The repository may be private or a token with repo scope is required.",
        code: "GITHUB_FORBIDDEN"
      });
    }

    if (status) {
      return res.status(502).json({
        error: `GitHub API returned an unexpected error (HTTP ${status}).`,
        code: "GITHUB_API_ERROR"
      });
    }

    console.error(error.message);
    res.status(500).json({
      error: "An unexpected error occurred while analyzing the pull request.",
      code: "INTERNAL_ERROR"
    });
  }
});

app.listen(PORT, () => {
  console.log(`PR Guardian backend running on http://localhost:${PORT}`);
});