# Sprint 3 Report

- **Product Name:** Verilet
- **Team Name:** Verilet
- **Date:** November 18, 2026
- **Team Members & Roles:**
  - Aubrey Hayes — Scrum Master
  - Yifei Peng — Product Owner
  - Adan Magaña-Bravo — Team Member
  - Devarsh Krishnan Jayakrishnan — Team Member
  - Lars Voigt-Bui — Team Member

---

## Actions to Stop Doing

1. **Stop leaving documents unhandled as soon as they become more relevant.**  
   _Explanation:_ When project documentation becomes relevant to ongoing work, we sometimes left them unhandled or unreviewed until late in the sprint. Keeping documentation continuously updated as technical decisions are made ensures the entire team always has a single source of truth and prevents misalignment.

2. **Stop making tickets that weren’t under a certain user story.**  
   _Explanation:_ Several tickets were created as work items without being linked to a user story in Jira. This made it difficult to determine which user story the work supported, cluttered our backlog, and created challenges when verifying completion against our Definition of Done. Moving forward, every technical task must be filed beneath its corresponding parent user story.

3. **Stop failing to break down user stories into multiple tasks that align with the overall project goal.**  
   _Explanation:_ Some user stories were kept as single large tickets rather than being decomposed into discrete technical tasks ($\le 6$ ideal hours) from the beginning. This made implementation and progress tracking difficult. We must ensure every user story is broken down into multiple tasks that support our sprint goals and release milestones.

---

## Actions to Start Doing

1. **Start avoiding underestimating the time needed for work remaining in a small sprint window.**  
   _Explanation:_ Our upcoming sprint is our final sprint of the class and is one day shorter than usual. Because of this timeframe and the need to deliver our final MVP, we must factor in extra buffer and error time rather than underestimating remaining work. Building in this margin will allow the team to stay calm, confident, and thorough as we wrap up the project.

2. **Start timeboxing meetings.**  
   _Explanation:_ Several team meetings and discussions ran longer than intended because topics drifted or dove too deep into implementation details without a boundary. We should start timeboxing all meetings to keep standups to a focused 15 minutes and setting explicit time limits for the agenda during planning and review sessions to keep discussions efficient and respect everyone's time.

---

## Actions to Keep Doing

1. **Continue to review PRs as soon as possible.**  
   _Explanation:_ The team was proactive in reviewing incoming pull requests during Sprint 3. Rapid code reviews prevented work from bottlenecking in the pipeline and enabled us to successfully merge 10 tasks and close 6 user stories before the sprint cutoff. We should keep this high review responsiveness in future sprints.

2. **Keep communicating over Discord for fast communication.**  
   _Explanation:_ Our Discord server served as an effective hub for team communication, pull request review notifications, blocker alerts, and technical coordination. Keeping our discussions fast, transparent, and centralized in Discord helped everyone stay synchronized across the sprint.

---

## Work Completed / Not Completed

### User Stories Completed During Sprint 3

- **Fully Completed User Stories:** **6 user stories**  
  _Explanation:_ In accordance with Verilet's Definition of Done and CSE 115A sprint criteria, a user story is marked completed only when all constituent tasks, acceptance criteria, automated Vitest test suites, and peer code reviews are approved and merged to `main`. In Sprint 3, 6 out of 7 planned user stories achieved 100% completion across both the task and user story levels:
  1. `SCRUM-3`: Paste listing link to extract details (8 pts · Aubrey Hayes)
  2. `SCRUM-15`: Fill out simple rental listing form (8 pts · Devarsh Krishnan Jayakrishnan)
  3. `SCRUM-21`: Flag illegal security deposits & excessive application fees (5 pts · Aubrey Hayes)
  4. `SCRUM-20`: Confirm property exists and residential zoning (5 pts · Adan Magaña-Bravo)
  5. `SCRUM-19`: Alert if listing rent is greatly below average price (5 pts · Yifei Peng)
  6. `SCRUM-48`: Short explanation of how Verilet works (5 pts · Devarsh Krishnan Jayakrishnan)

- **Tasks Completed from Sprint 3 User Stories (41.0 Ideal Work Hours):**
  1. **`SCRUM-3-T-3`**: Add a listing-link search bar with URL validation, active loading spinner, and autofill integration into the listing form (`client/src/components/ListingForm.tsx`).
     - _Parent Story:_ User Story 1 (`SCRUM-3`: Paste listing link)
     - _Assignee:_ Aubrey Hayes
     - _Estimated Ideal Work Hours:_ 5.0 hours  
       _Note: Merged via PR #24 (`closes SCRUM-3`)._
  2. **`SCRUM-15-T-1`**: Finalize PR review revisions, input validation edge-cases, and merge manual listing form to receive scraper autofill.
     - _Parent Story:_ User Story 2 (`SCRUM-15`: Fill out simple rental listing form)
     - _Assignee:_ Devarsh Krishnan Jayakrishnan
     - _Estimated Ideal Work Hours:_ 0.0 hours _(Implementation credited in Sprint 2; PR review revisions and final merge completed in Sprint 3)_
  3. **`SCRUM-21-T-1`**: Create `securityDeposit.service.ts` with Zod schema, California AB 12 deposit cap evaluation, standardized result envelope, and Vitest suite.
     - _Parent Story:_ User Story 3 (`SCRUM-21`: Flag illegal security deposits & fees)
     - _Assignee:_ Aubrey Hayes
     - _Estimated Ideal Work Hours:_ 4.0 hours
  4. **`SCRUM-21-T-2`**: Create `applicationFee.service.ts` with Zod schema, California Civil Code § 1950.6 $65 statutory fee limit check, standardized result envelope, and Vitest suite.
     - _Parent Story:_ User Story 3 (`SCRUM-21`: Flag illegal security deposits & fees)
     - _Assignee:_ Aubrey Hayes
     - _Estimated Ideal Work Hours:_ 4.0 hours
  5. **`SCRUM-20-T-1`**: Create `gisLandUse.service.ts` with `GisAddressInputSchema` and Santa Cruz County Assessor MapServer ArcGIS REST query builder with normalized address matching and 5000ms timeout handling.
     - _Parent Story:_ User Story 4 (`SCRUM-20`: Confirm property exists & residential zoning)
     - _Assignee:_ Adan Magaña-Bravo
     - _Estimated Ideal Work Hours:_ 4.0 hours
  6. **`SCRUM-20-T-2`**: Implement assessor `USECDDESC` land use code evaluation, non-residential/unverified flag triggers, standardized JSON envelope, and offline Vitest tests with mocked parcel fixtures.
     - _Parent Story:_ User Story 4 (`SCRUM-20`: Confirm property exists & residential zoning)
     - _Assignee:_ Adan Magaña-Bravo
     - _Estimated Ideal Work Hours:_ 4.0 hours
  7. **`SCRUM-18-T-1`**: Flag untraceable payment terms (crypto, wire transfers, gift cards) in listing text with structured violation objects (`server/services/paymentFlags.service.js`).
     - _Parent Story:_ User Story 5 (`SCRUM-18`: High-risk payment method alerts)
     - _Assignee:_ Lars Voigt-Bui
     - _Estimated Ideal Work Hours:_ 6.0 hours
  8. **`SCRUM-19-T-1`**: Implement `averagePrice.service.ts` comparing listing rent against Santa Cruz and San Jose median baseline thresholds from MongoDB Atlas.
     - _Parent Story:_ User Story 6 (`SCRUM-19`: Below-market rent outlier alert)
     - _Assignee:_ Yifei Peng
     - _Estimated Ideal Work Hours:_ 6.0 hours
  9. **`SCRUM-19-T-3`**: Read rent data from the database named in `RENT_DB_NAME`, document test replica database, and write offline Vitest tests.
     - _Parent Story:_ User Story 6 (`SCRUM-19`: Below-market rent outlier alert)
     - _Assignee:_ Yifei Peng
     - _Estimated Ideal Work Hours:_ 3.0 hours
  10. **`SCRUM-48-T-8`**: Build interactive road-style "How it works" animated visualization route (`/how-it-works`) explaining the 4-tier verification process with scroll-driven car animation.
      - _Parent Story:_ User Story 7 (`SCRUM-48`: Explanation of how Verilet works)
      - _Assignee:_ Devarsh Krishnan Jayakrishnan
      - _Estimated Ideal Work Hours:_ 5.0 hours

---

### User Stories Not Completed During Sprint 3

_The following user story was planned for Sprint 3 and actively developed, but remained partially completed at the November 18 cutoff and rolls over into Sprint 4:_

1. **User Story 5: As a student, I want the system to alert me if the lister asks for high-risk payment methods so that I don't send money through unsafe methods.**
   - _Jira Key:_ `SCRUM-18` | _Story Points:_ 5 | _Priority Rating:_ 3
   - _Completed in Sprint 3:_ 1 task (`SCRUM-18-T-1` [6.0 hrs]: Flag untraceable payment terms such as cryptocurrency, wire transfers, and gift cards, merged via PR #20).
   - _Remaining Work / Reason Not Completed:_ The second task, `SCRUM-18-T-2` (6.0 hrs: Proximity regex detecting P2P cash app advance-fee terms paired with deposit requests), was in active development (Jira `SCRUM-37`: In Progress) but was not finalized or merged before the sprint deadline. In accordance with our Definition of Done, parent story `SCRUM-18` rolls over into Sprint 4.

---

## Work Completion Rate

- **Total User Stories Fully Completed:** 6 user stories
- **Total Tasks Completed from User Stories:** 10 tasks
- **Total Estimated Ideal Work Hours Completed:** 41.0 hours
- **Total Days in Sprint 3:** 14 days _(November 5 – November 18, 2026)_

### Sprint 3 Velocity

- **User Stories Completed per Day:**  
  $$\frac{6\text{ stories}}{14\text{ days}} = 0.43\text{ stories/day}$$

- **Tasks Completed per Day:**  
  $$\frac{10\text{ tasks}}{14\text{ days}} = 0.71\text{ tasks/day}$$

- **Ideal Work Hours Completed per Day:**  
  $$\frac{41.0\text{ ideal hours}}{14\text{ days}} = 2.93\text{ ideal hours/day}$$

### Multi-Sprint Averages

_Computed across all sprints to date (Sprint 1: 14 days, Sprint 2: 14 days, Sprint 3: 14 days; Total: 42 days):_

- **Total Ideal Work Hours Completed Across All Sprints:**  
  $$21.75\text{ hours (S1)} + 15.00\text{ hours (S2)} + 41.00\text{ hours (S3)} = 77.75\text{ ideal work hours}$$

- **Average Ideal Work Hours Completed per Day (Across All Sprints):**  
  $$\frac{77.75\text{ ideal hours}}{42\text{ days}} = 1.85\text{ ideal hours/day}$$

- **Average Fully Completed User Stories per Day (Across All Sprints):**  
  $$\frac{10\text{ stories (S1)} + 0\text{ stories (S2)} + 6\text{ stories (S3)}}{42\text{ days}} = \frac{16}{42} = 0.38\text{ stories/day}$$

- **Average Completed Work Tasks per Day (Across All Sprints):**  
  $$\frac{10\text{ tasks (S1)} + 4\text{ tasks (S2)} + 10\text{ tasks (S3)}}{42\text{ days}} = \frac{24}{42} = 0.57\text{ task units/day}$$

---

## Sprint Burnup Chart

![Sprint 3 Burnup Chart](../assets/sprint_3_final_burnup.svg)

_The final sprint burnup chart for Sprint 3 is embedded above, available for viewing in the lab, and submitted alongside this report._

- **Total Planned Scope:** 47.00 Ideal Work Hours (7 User Stories, 10 Tasks)
- **Completed Work:** 41.00 Ideal Work Hours (6 Fully Completed User Stories, 10 Completed Tasks)
- **Remaining / Carried Over:** 6.00 Ideal Work Hours (`SCRUM-18-T-2`: P2P cash-app advance fee proximity regex)
