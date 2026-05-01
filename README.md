# CrowdSolve – Community Problem Reporting Platform

CrowdSolve is a web-based platform that allows citizens to report, track, and manage real-world community issues such as water leakage, road damage, and electricity problems.

---

## 🚀 Features

- 📍 Map-based location selection
- 📝 Report issues with description & category
- 🔁 Duplicate issue detection
- 🏷️ Issue status tracking (Reported → Assigned → In Progress → Resolved)
- 🧑‍💼 Authority dashboard for managing complaints
- 🗑️ Soft delete functionality
- 📷 Evidence upload system

---


## ⚙️ How to Run

```bash
git clone https://github.com/Harmy-Dankhara/crowdsolve.git
cd crowdsolve
uvicorn backend.main:app --reload
