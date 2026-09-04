// Seed data for the Contract Transparency Portal.
// Sourced from: Project Financial Analysis Next Gen.xlsx (AO EAC Table, per-call tabs),
// Call Order Staffing.xlsx (Resource by Call Order), Jun 2026 MSR.docx, Weekly Touchpoint 090826.docx
//
// Shapes here mirror the source workbooks (positional arrays); seed.ts normalises them into tables.

export type SeedLcat = [name: string, fte: number, hours: number, rate: number];
export type SeedStaff = [name: string, lcat: string, rate: number, status: string];
export type SeedEntry = [title: string, text: string];
export type SeedMsrStaff = [division: string, name: string, start: string, lcat: string];

export interface SeedCallOrder {
  id: string;
  group: string;
  groupName: string;
  name: string;
  pop: string;
  funded: number;
  spend: number;
  remaining: number;
  eac: number | null;
  over: number | null;
  pm: string;
  lcats: SeedLcat[];
  staff: SeedStaff[];
  highlights: string[];
}

export interface SeedWeeklyReport {
  key: string;
  week: string;
  file: string;
  by: string;
  status: string;
  href: string;
}

export interface SeedMsrSection {
  title: string;
  funding: [string, number | null][];
  completed: SeedEntry[];
  planned: SeedEntry[];
  staffing: SeedMsrStaff[];
  risks: string[];
  issues: string[];
  travel: string;
}

export interface SeedMonthlyReport {
  key: string;
  period: string;
  file: string;
  by: string;
  due: string;
  status: string;
  href: string;
  scope: string;
  program: {
    newContractors: string[][];
    departures: string[][];
    movement: string[][];
  };
  sections: Record<string, SeedMsrSection>;
}

export const DATA: SeedCallOrder[] = [
  {
    id: "Call 2.3", group: "Call 002", groupName: "Enterprise Architecture (EA) Support", name: "Enterprise Architecture (EA) Support", pop: "9/26/25 – 9/25/26",
    funded: 3225811.68, spend: 2575020.37, remaining: 650791.31, eac: 3146252.37, over: 79559.31,
    pm: "Ceenil Kaur",
    lcats: [["Business Analyst – Senior",2,1912,122.45],["Enterprise Architect",3,1912,115.47],["Systems Integration Engineer",3,1912,154.94],["Project Manager – Mid",1,1912,81.63],["Communications Specialist – Senior",1,1912,75.92],["Cloud Architect – CDaaS/PaaS/Cloud Hosting",1,1912,155.10],["Systems Architect",2,1912,110.20],["Data Architect",1,1912,97.96],["Systems Integration Engineer",5,478,154.94],["Business Analyst – Senior",1,478,122.45],["Business Analyst – Mid",1,478,97.96]],
    staff: [["Alisa Welch","Business Analyst – Senior",122.45,"Moving to Business Architect"],["Ramajyothi Indukuri","Business Analyst – Senior",122.45,"Assigned"],["Ranga Lakshminarayanan","Cloud Architect – CDaaS/PaaS",155.10,"Assigned"],["Alec Gura","Communications Specialist",75.92,"Assigned"],["Yenenesh Shewaneh","Data Architect",97.96,"Assigned"],["Sudeep Telang","Enterprise Architect",115.47,"Assigned"],["Vidyadhar Tanksale","Enterprise Architect",115.47,"Assigned"],["Carl Mosca","Systems Integration Engineer",154.94,"LCAT change proposed"],["Ceenil Kaur","Project Manager",81.63,"Assigned"],["Christopher Harkins","Systems Integration Engineer",154.94,"Assigned"],["Jayson Guglietta","Systems Integration Engineer",154.94,"Replacement requested"],["Navin Keswani","Systems Integration Engineer",154.94,"Assigned"],["Zakariya Saleh","Systems Architect",110.20,"Assigned"],["Mohammad Khan","Systems Integration Engineer",154.94,"Assigned"],["Chetna Walia","Business Analyst – Senior",122.45,"Started 8/24"],["Nagarajan Pattabiraman","Systems Integration Engineer",154.94,"Assigned"],["David Ylizarde","Systems Integration Engineer",154.94,"PIV pending"],["John Bauer","Systems Integration Engineer",154.94,"Assigned"],["John Castro","Systems Integration Engineer",154.94,"Assigned"],["VACANT – Madhavan Ramamoorthy resigned 11/30","Systems Architect",108.04,"Vacant"],["VACANT – Business Architect (Alisa Welch to cover)","Systems Integration Engineer",154.94,"Vacant"],["VACANT – Data Architect, sourcing","Business Analyst – Mid",97.97,"Vacant"]],
    highlights: ["Business Architect: moving Alisa Welch into the role from EA Standards; Nada Conway planned as backfill (started 8/27).","Business Analyst: Chetna Walia started 8/24.","Data Architect: final selection down to one candidate; Nat Iyer is no longer available.","Discrepancy: 3 Systems Integration Engineers are contracted, 5 are currently assigned.","This call order period ends 9/25/26."]
  },
  {
    id: "Call 4.3", group: "Call 004", groupName: "Multifactor Authentication (MFA) Support", name: "Multifactor Authentication (MFA) Support", pop: "4/10/26 – 4/9/27",
    funded: 1941638.40, spend: 520681.92, remaining: 1420956.48, eac: 1457738.96, over: 483899.44,
    pm: "Lauryn Brown",
    lcats: [["Systems Integration Engineer",6,1920,154.94],["Project Manager",1,1920,81.63]],
    staff: [["Muhammad Nazir","Systems Integration Engineer",154.94,"Assigned"],["Narayan Verma","Systems Integration Engineer",154.94,"Assigned"],["Sunil Bandapally","Systems Integration Engineer",154.94,"Assigned"],["Lauryn Brown","Project Manager",81.63,"Maternity leave, returns 9/8"],["Sangamewar Gupta","Systems Integration Engineer",154.94,"Assigned"],["Karaman Talibov","Systems Integration Engineer",154.94,"Assigned"],["VACANT – Holding","Systems Integration Engineer",151.90,"Vacant"]],
    highlights: ["Lauryn Brown has been on maternity leave since 8/11; anticipated return 9/8 after an additional week.","One Systems Integration Engineer position is vacant and on hold."]
  },
  {
    id: "Call 13.1", group: "Call 013", groupName: "DevSecOps Support", name: "DevSecOps Support", pop: "9/13/25 – 9/12/26",
    funded: 1491977.28, spend: 1242382.55, remaining: 249594.73, eac: 1463896.15, over: 28081.13,
    pm: "—",
    lcats: [["Systems Integration Engineer",4,1920,154.94],["Business Analyst – Senior",1,1920,122.45]],
    staff: [["Madhur Gupda","Business Analyst – Senior",124.90,"Assigned"],["Vijay Sivaprakasam","Systems Integration Engineer",158.04,"Assigned"],["Harsh Jain","Systems Integration Engineer",158.04,"Assigned"],["Olusola Awodeu","Systems Integration Engineer",158.04,"Assigned"],["Devarshi Pathak","Systems Integration Engineer",158.04,"PIV received"],["Mohana Molabanti","Systems Integration Engineer",158.04,"Assigned"]],
    highlights: ["No status items reported for the current touchpoint."]
  },
  {
    id: "Call 13.2", group: "Call 013", groupName: "DevSecOps Support", name: "DevSecOps Support", pop: "9/13/26 – 9/12/27",
    funded: 1756992.00, spend: 0, remaining: 1756992.00, eac: null, over: null,
    pm: "—",
    lcats: [["Systems Integration Engineer",4,1920,154.94],["Business Analyst – Senior",1,1920,122.45]],
    staff: [],
    highlights: ["Option period funded; performance begins 9/13/26."]
  },
  {
    id: "Call 15.1", group: "Call 015", groupName: "Innovation & Research (I&R)", name: "Innovation & Research (I&R)", pop: "9/25/25 – 9/24/26",
    funded: 1853995.87, spend: 1069330.24, remaining: 784665.63, eac: 1310034.40, over: 543961.47,
    pm: "—",
    lcats: [["Business Analyst – Senior",1,1912,122.45],["Software Engineer",1,1912,141.14],["Artificial Intelligence (AI) Engineer",2,1912,122.45],["Enterprise Architect",1,1912,115.47],["Systems Integration Engineer",1,1912,154.94],["Information Assurance Engineer",1,1912,85.71]],
    staff: [["Louie Chen","Artificial Intelligence (AI) Engineer",122.45,"Assigned"],["Kenneth Megill","Business Analyst – Senior",122.45,"Assigned"],["Louden Motina","Enterprise Architect",115.47,"Assigned"],["Jason De Kock","Systems Integration Engineer",154.94,"Assigned"],["Syed Abbas","Information Assurance Engineer",85.71,"Assigned"],["Dhruvi Rathod","Information Assurance Engineer",85.71,"Assigned"],["VACANT – Holding","Artificial Intelligence (AI) Engineer",120.05,"Vacant"],["VACANT – Holding","Software Engineer",141.14,"Vacant"],["VACANT – FTE covered by Syed and Dhruvi full time","Software Developer",103.00,"Vacant"]],
    highlights: ["Expansion positions beginning 9/25 at the start of the new option period: two Agile Coach/Consultant – Senior and one Business Systems Analyst – Mid.","Shawn Faunce and Megan Giesy move over from the ZTA call order for the Agile Coach/Consultant roles.","Mary Raguso moves over from ZTA for the Business Systems Analyst – Mid position."]
  },
  {
    id: "Call 16.1", group: "Call 016", groupName: "Reliability & Availability Engineering (RAE)", name: "Reliability & Availability Engineering (RAE)", pop: "2/26/26 – 2/25/27",
    funded: 3383404.80, spend: 1270961.22, remaining: 2112443.58, eac: 3139912.02, over: 243492.78,
    pm: "Andrew Camp",
    lcats: [["Agile Coach",4,1920,143.11],["Communications Specialist",1,1920,75.92],["Cyber Threat Analyst",2,1920,96.18],["Enterprise Architect",2,1920,115.47],["Information Systems Engineer",2,1920,122.45],["Project Manager",1,1920,81.63],["Systems Engineer",3,1920,111.43]],
    staff: [["Darren Boykin","Information Systems Engineer",122.45,"Assigned"],["Andrew Camp","Project Manager",81.63,"Assigned"],["Jessica De La Salle","Communications Specialist",75.92,"Assigned"],["Hao (Ray) Duong","Software Engineer",141.14,"Assigned"],["Benjamin Eseku","Cyber Threat Analyst",96.18,"Assigned"],["Prathyusha Gaddam","Information Systems Engineer",122.45,"Assigned"],["Deloy Johnson","Systems Engineer",111.43,"Assigned"],["Joseph Lee","Systems Engineer",111.43,"Assigned"],["Austin Bishop","Agile Coach",143.11,"PIV received"],["Shamroze Niazi","Enterprise Architect",115.47,"Assigned"],["Paul Schomburg","Agile Coach",143.11,"Assigned"],["Pankaj Shishodia","Agile Coach",143.11,"CMMI training"],["Patrick Shubird","Systems Engineer",111.43,"Assigned"],["Nick Sundar","Enterprise Architect",115.47,"Assigned"],["Ram Daesari","Agile Coach",143.11,"Assigned"],["Dora Mensah","Cyber Threat Analyst",96.18,"Offboarded 8/28"]],
    highlights: ["Dora Mensah, Cyber Threat Analyst, offboarded 8/28; PIV card and laptop retrieved and returned to the AO.","Reza begins work once his laptop arrives; targeting 9/8.","Outreach to Chuck Diard for Courtroom Technology support; he is interested in a full-time opportunity."]
  },
  {
    id: "Call 17", group: "Call 017", groupName: "Enterprise IT Program Management (EITPM)", name: "Enterprise IT Program Management (EITPM)", pop: "9/1/25 – 8/31/26",
    funded: 1681420.80, spend: 1452328.66, remaining: 229092.14, eac: 1615344.66, over: 66076.14,
    pm: "Taiwo Adenuga",
    lcats: [["Project Manager",1,1920,81.63],["Agile Coach / Consultant",5,1920,143.11],["Agile Certified Professional",1,1920,78.56]],
    staff: [["Taiwo Adenuga","Project Manager",81.63,"Assigned"],["Samrah Kashif","Agile Coach / Consultant",143.11,"Assigned"],["Patti April","Agile Coach / Consultant",143.11,"Assigned"],["Robert Carpenter","Agile Coach / Consultant",143.11,"Assigned"],["Natalee Savage","Agile Coach / Consultant",143.11,"Assigned"],["Amir Bawani","Agile Coach / Consultant",143.11,"Assigned"],["Dipika Jain","Agile Certified Professional",78.56,"Assigned"],["James Rader","Agile Coach / Consultant",143.11,"Assigned"]],
    highlights: ["No status items reported for the current touchpoint."]
  },
  {
    id: "Call 17.1", group: "Call 017", groupName: "Enterprise IT Program Management (EITPM)", name: "Enterprise IT Program Management (EITPM)", pop: "9/1/26 – 8/31/27",
    funded: 1940185.51, spend: 0, remaining: 1940185.51, eac: null, over: null,
    pm: "Taiwo Adenuga",
    lcats: [["Project Manager",1,1920,81.63],["Agile Coach / Consultant",5,1920,143.11],["Agile Certified Professional",1,1920,78.56]],
    staff: [],
    highlights: ["Option period funded; performance begins 9/1/26."]
  },
  {
    id: "Call 18", group: "Call 018", groupName: "Zero Trust Architecture (ZTA)", name: "Zero Trust Architecture (ZTA)", pop: "9/15/25 – 9/14/26",
    funded: 2000000.00, spend: 1469174.48, remaining: 530825.52, eac: 1750020.08, over: 249979.92,
    pm: "—",
    lcats: [["Agile Coach / Consultant",2,1920,143.11],["Cloud Architect",3,1920,155.10],["Systems Integration Engineer",1,1920,154.94],["Data Scientist",1,1920,141.44],["Information Systems Engineer",1,1920,122.45]],
    staff: [["Shawn Faunce","Agile Coach / Consultant",143.11,"Moving to I&R 9/25"],["Nat Iyer","Cloud Architect",155.10,"No longer available"],["Tapan Rath","Cloud Architect",155.10,"Assigned"],["GyVonda N McCain","Systems Integration Engineer",154.94,"Assigned"],["David Prompovitch","Data Scientist",141.44,"Assigned"],["Mary Raguso","Information Systems Engineer",122.45,"Moving to I&R 9/25"],["Megan Giesy","Agile Coach / Consultant",143.11,"Moving to I&R 9/25"],["VACANT – Omni Davis","Cloud Architect",155.10,"Vacant"]],
    highlights: ["Training videos return to the airport model: four planned videos, three under two minutes and one around three to four minutes.","All storyboards are complete and reviewed by Cheryl and Kevin.","This call order period ends 9/14/26."]
  },
  {
    id: "Call 19", group: "Call 019", groupName: "Technology Business Management (TBM) Study", name: "Technology Business Management (TBM) Study", pop: "9/2/26 – 4/1/27",
    funded: 288249.56, spend: 0, remaining: 288249.56, eac: null, over: null,
    pm: "—", lcats: [], staff: [],
    highlights: ["New call order awarded 8/28.","To be included in the monthly status report alongside the other call orders."]
  }
];

export const WEEKLY_REPORTS: SeedWeeklyReport[] = [
  { key: "wk-090826", week: "Sep 8, 2026", file: "Weekly Touchpoint 090826.docx", by: "Paul Schomburg", status: "Submitted", href: "uploads/Weekly Touchpoint 090826.docx" }
];

// BPA-level contractual deliverable. One document per reporting period, covering all call orders.
export const MONTHLY_REPORTS: SeedMonthlyReport[] = [
  { key: "msr-jun26", period: "June 2026", file: "Jun 2026 MSR.docx", by: "Program Office", due: "Jul 15, 2026", status: "Accepted", href: "uploads/Jun 2026 MSR.docx",
    scope: "Reporting Period: June 1–30, 2026",
    program: {
      newContractors: [["Ram Dasari", "6/29/2026", "CO 16", "Agile Coach"]],
      departures: [["Omni Davis", "5/29/2026", "CO 18", "Cloud Architect"]],
      movement: []
    },
    sections: {
      "Call 2.3": {
        title: "Call Order 002 – Enterprise Architecture (EA) Support",
        funding: [["Funds Obligated", 3225811.68], ["Funds Expended to Date", 1695515.53], ["Funds Remaining", 1530296.15], ["Estimate at Completion", 3087893.53], ["Over/Under", 137918.15]],
        completed: [
          ["Technical Architecture (As Is)", "Continued development and refinement of Enterprise Architecture (EA) As-Is dashboards. Coordinated with Dynatrace on API integration and runtime validation planning. Advanced Technology Reference Model (TRM) lifecycle governance by refining evaluation criteria and hierarchy alignment based on stakeholder feedback and governance reviews."],
          ["IT Application and Systems Authentication Standard", "Completed review activities and submitted the standard for EAMB approval. Publication on JNET and SharePoint is pending approval."],
          ["Blue Folder and Judiciary-Wide Review Process", "Completed revisions to the Blue Folder and Judiciary-Wide Review process to align with updated workflows and organizational changes. Updated supporting process documentation and checklists."],
          ["IT Standards Center of Excellence (COE)", "Completed SharePoint site layout and wireframe development. Conducted multiple stakeholder demonstrations to collect feedback on navigation and user experience. Prepared the site for final demonstration and User Acceptance Testing (UAT)."],
          ["IT Public Cloud Standard", "Continued development of the standard through collaborative sessions focused on requirements analysis, content development, and stakeholder alignment."],
          ["IT Vulnerability and Patch Management Standard", "Continued development of the standard through stakeholder engagement, requirements refinement, and content development activities."],
          ["Security Domain", "Continued development of the Controlled Unclassified Information (CUI) Policy Framework to support Data Loss Prevention (DLP) requirements and guidance. Completed the Future of Infrastructure and CM/ECF Executive and Technical documents and submitted them for leadership review."],
          ["IT Standards Maturity Model", "Conducted working sessions and presented the maturity model to leadership. The model is currently undergoing final review prior to publication on the IT Standards Center of Excellence (COE) SharePoint site."],
          ["Judiciary IT Standards Documentation Update", "Continued progress on the COE template library, with most templates drafted and under review. The library will provide standardized artifacts that support the end-to-end IT standards lifecycle."]
        ],
        planned: [
          ["Technical Architecture (As Is)", "Continue enhancement of EA As-Is dashboards through coordination with the OTIS team to implement a JSON REST API for automated daily VM metadata refreshes, replacing manual CSV extracts. Continue Dynatrace API integration and runtime validation activities. Finalize TRM lifecycle governance refinements."],
          ["IT Application and Systems Authentication Standard", "Support publication activities upon receipt of EAMB approval."],
          ["Blue Folder and Judiciary-Wide Review Process", "Project completed; no additional activities planned."],
          ["IT Standards Center of Excellence (COE)", "Conduct the final stakeholder demonstration, complete UAT activities, and prepare the site for production deployment."],
          ["IT Public Cloud Standard", "Finalize the initial draft of the standard and submit it for SME review and feedback."],
          ["IT Vulnerability and Patch Management Standard", "Finalize the initial draft of the standard and submit it for SME review and feedback."],
          ["Security Domain", "Continue assessment activities related to VMware replacement efforts and advance development of the CUI Policy Framework supporting DLP requirements."],
          ["IT Standards Maturity Model", "Complete final review activities and publish the maturity model on the COE SharePoint site."],
          ["Judiciary IT Standards Documentation Update", "Complete the remaining COE templates and publish the template library."]
        ],
        staffing: [["Enterprise Arch","Amit Yadav","10/3/2022","Sys Integration Engr"],["Enterprise Arch","Chris Harkins","11/1/2022","Sys Integration Engr"],["Enterprise Arch","Vidyadhar Tanksale","3/13/2023","Enterprise Architect"],["Enterprise Arch","Alisa Welch","10/24/2022","Business Analyst"],["Enterprise Arch","Alec Gura","7/10/2023","Communications Specialist"],["Enterprise Arch","Jason Guglietta","12/4/2023","Systems Integration Engineer"],["Enterprise Arch","Sudeep Telang","11/5/2024","Enterprise Architect"],["Enterprise Arch","Navin Keswani","11/4/2024","Systems Integration Engineer"],["Enterprise Arch","Ranga Lakshminarayanan","4/6/2026","Cloud Architect"],["Enterprise Arch","Ramajyothi Indukuri","11/18/2024","Business Analyst"],["Enterprise Arch","Zakariya Saleh","12/9/2024","Systems Architect"],["Enterprise Arch","Yenenesh Shewaneh","3/25/2025","Data Architect"],["Enterprise Arch","Carl Mosca","12/8/2025","Systems Integration Engineer"],["Enterprise Arch","Ceenil Kaur","12/15/2025","Project Manager"],["Enterprise Arch","Moiz Khan","10/15/2024","Systems Integration Engineer"]],
        risks: ["Schedule Adjustment: A 30–60 day schedule extension may be required for the IT Public Cloud Standard and IT Vulnerability & Patch Management Standard to accommodate additional development, stakeholder review, and EAMB approval activities."],
        issues: [], travel: "N/A"
      },
      "Call 4.3": {
        title: "Call Order 004 – MFA Support",
        funding: [["Funds Obligated", 1903545.60], ["Funds Expended to Date", 1470887.63], ["Funds Remaining", 432657.97], ["Estimate at Completion", 1510035.15], ["Over/Under", 393510.45]],
        completed: [
          ["MFA Support", "Continued operational support across MFA initiatives, including Login.gov onboarding support, application team coordination, and vulnerability remediation activities. Supported OSCAR Login.gov planning efforts through recurring working sessions, application walkthroughs, questionnaire reviews, and documentation updates. Resolved longstanding DUO support issue impacting MacOS offline authentication."],
          ["WHfB", "Continued troubleshooting and escalation efforts with Microsoft related to on-premises Certificate Trust enrollment and authentication issues. Collected and provided additional logs to Microsoft engineering teams and updated hybrid deployment documentation."],
          ["PIV-I for VPN", "Advanced project closeout activities through stakeholder review and recommendation package updates. Coordinated review cycles with Michael Keyes, the EA Team, and ISO stakeholders."],
          ["Adaptive Authentication", "Progressed Proof of Concept implementation through ISVA installation and configuration, adaptive authentication use case development, conditional access policy configuration, and lab environment expansion. Completed testing scenarios for Zscaler VPN, Windows desktop login, and conditional access risk-factor evaluations."],
          ["Elevated Access", "Continued development of current-state architecture documentation, process flows, and gap analysis activities in coordination with CyberArk stakeholders. Progressed environment access coordination and testing preparation activities."],
          ["YubiKey", "Project formally closed. Completed lessons learned documentation, archived project artifacts, finalized stakeholder communications, and transitioned deliverables into long-term reference documentation status."],
          ["EA As-Is", "Continued development and refinement of EA As-Is dashboards and coordination with Dynatrace related to API integration and runtime validation planning. Continued refinement of TRM lifecycle governance, evaluation criteria, and hierarchy alignment."]
        ],
        planned: [
          ["MFA Support", "Continue Login.gov onboarding support and coordination activities, vulnerability tracking activities, refining templates to use across all projects, and updating VM processes."],
          ["WHfB", "Continue Microsoft escalation efforts and engineering coordination to resolve remaining on-prem issues and close out on-prem resolution. Complete hybrid documentation updates."],
          ["Adaptive Authentication", "Continue development and execution of adaptive authentication use cases within the lab environment. Expand conditional access policy testing, validate additional authentication scenarios, and continue development of POC findings and recommendations."],
          ["Elevated Access", "Complete current-state assessment activities, finalize current state assessment and gaps, refine scope, architecture diagrams, and implementation considerations based on stakeholder feedback, and start working on future-state architecture development."],
          ["YubiKey", "No planned activities. Project closed."],
          ["PIV-I for VPN", "No planned activities. Project closed."],
          ["EA As-Is", "Continue refinement of EA As-Is dashboards via coordination with the OTIS team to build a JSON REST API to receive daily refresh of VM metadata, replacing manual CSV extracts. Complete refinement of TRM lifecycle governance and develop a presentation to share TRM governance flow expectations."]
        ],
        staffing: [["Service Delivery","Muhammad Nazir","5/22/2023","System Integration Engineer"],["Service Delivery","Sunil Bandapally","7/10/2023","Systems Integration Engineer"],["Service Delivery","Narayan Verma","7/17/2023","Systems Integration Engineer"],["Service Delivery","Sangameswar Gupta","6/17/2024","Systems Integration Engineer"],["Service Delivery","Lauryn Holcomb","8/7/2023","Project Manager"],["Service Delivery","Karaman Talibov","1/20/2026","Systems Integration Engineer"]],
        issues: [
          "WHfB: Ongoing Microsoft support coordination for on-premises Certificate Trust authentication failures continues to delay completion of validation activities. Resolution: continued escalation with Microsoft engineering teams, submission of additional diagnostic logs, and parallel internal troubleshooting to isolate root cause.",
          "MFA Support: Login.gov onboarding and support activities continue to require recurring coordination across multiple application teams, creating competing priorities for project resources. Resolution: continued use of recurring working sessions, centralized documentation, and coordinated stakeholder engagement."
        ],
        risks: [
          "WHfB: Continued dependency on Microsoft engineering support and supporting infrastructure components (ADFS, Certificate Services, Entra ID) may impact project timeline and final validation activities. Mitigation: maintain escalation pathways, continue recurring support engagements, and pursue parallel validation and documentation activities.",
          "MFA Support: Ongoing support demands, vulnerability remediation, and application onboarding efforts may compete with project execution timelines across the MFA portfolio. Mitigation: continue centralized tracking and prioritization through JIRA dashboards, recurring coordination meetings, and workload management processes.",
          "EA As-Is (1): Organizational restructuring and evolving governance responsibilities may create ambiguity around ownership of business capabilities, application stewardship, and technology domains. Mitigation: continue development and enforcement of the EA governance model, RACI matrix, and Architecture Review Board processes.",
          "EA As-Is (2): Application, infrastructure, and technology data may remain fragmented or inconsistent across CSAM, CMDB, OTIS, Dynatrace, and program office inventories, impacting the accuracy of the enterprise architecture baseline. Mitigation: establish a centralized authoritative EA repository and continue phased data normalization and validation."
        ],
        travel: "N/A"
      },
      "Call 13.1": {
        title: "Call Order 013 – DevSecOps",
        funding: [["Funds Obligated", 1425043.20], ["Funds Expended to Date", 744032.29], ["Funds Remaining", 681010.91], ["Estimate at Completion", 1417469.17], ["Over/Under", 7574.03]],
        completed: [
          ["", "Investigated implementation approaches for OpenTelemetry, Kubernetes RBAC, VMware Infrastructure as Code (IaC), and internal certificate auto-renewal to provide recommendations that support improved observability, least-privilege access, infrastructure automation, and certificate lifecycle management."],
          ["", "Strengthened the security posture of platform components by cleaning up Log4j and OpenJDK 21 vulnerabilities in custom images, updating the Selenium Hub Java base image, and addressing critical Containerd vulnerabilities identified in the Splunk report."],
          ["", "Advanced DevSecOps automation by configuring a Git event-based deployment pipeline and integrating SonarQube, Fortify, and Black Duck with the InfoWeb chat application, enabling automated deployments and improved application security scanning."],
          ["", "Developed an assessment form based on identified requirements, reviewed it with the Product Owner and stakeholders, and incorporated feedback to improve the quality and readiness of the assessment before distribution."],
          ["", "Investigated and documented approaches for managing existing and new VMware virtual machines using Infrastructure as Code, providing implementation guidance, best practices, and reusable patterns."]
        ],
        planned: [
          ["", "Complete the evaluation of container/Dockerfile vulnerability scanning tools and implement Cosign digital signing in the CI/CD pipeline to strengthen container security and software supply chain integrity."],
          ["", "Create a Kubernetes Dashboard UI, externalize Helm values into environment-specific ArgoCD configurations, and implement branch/tag-based environment promotion logic."],
          ["", "Upgrade Fortify from version 21 to version 26, including preparing the licensed Docker image and publishing it to Artifactory, to restore vendor support and maintain secure code scanning."],
          ["", "Continue reviewing the assessment form with stakeholders, investigate Developer Portal support for VM applications, and test Selenium Hub when a stable OpenJDK version is available."],
          ["", "Remediate the OpenSSL vulnerability on the PostgreSQL server and sandbox cluster by updating the affected RHEL packages."]
        ],
        staffing: [["Service Delivery","Vijay Sivaprakasam","9/30/2024","Systems Integration Engineer"],["Service Delivery","Harsh Jain","11/25/2024","Systems Integration Engineer"],["Service Delivery","Madhur Gupta","4/16/2025","Business Analyst"],["Service Delivery","Shailendra Gohil","3/22/2024","Systems Integration Engineer"],["Service Delivery","Olusola Awoderu","12/26/2023","Software Engineer"],["Service Delivery","Mohana Molabanti","8/28/2023","Cloud Architect"]],
        issues: [], risks: [], travel: "N/A"
      },
      "Call 15.1": {
        title: "Call Order 015 – Innovation & Research",
        funding: [["Funds Obligated", 1853995.87], ["Funds Expended to Date", 744603.44], ["Funds Remaining", 1109392.43], ["Estimate at Completion", 1378035.44], ["Over/Under", 475960.43]],
        completed: [
          ["", "Continued deploying the JEFS internal site to Azure Kubernetes Service as proof of concept and cloud cost evaluation."],
          ["", "Continued development of the InfoWeb Support Guide Chatbot, focusing on usability and integration with existing documentation."],
          ["", "Completed development assistance of the ARC Hub, expanding semantic search and summarization capabilities."],
          ["", "Completed development assistance of the CVB solution, progressing structured data extraction capabilities."],
          ["", "Completed development assistance of the cross-cloud PDF text extraction capability toward broader applicability across use cases."],
          ["", "Continued refinement of Courtney and the Online Judicial Guide in alignment with AO priorities."],
          ["", "Continued working with AO leadership to define and formalize the operating model, ensuring clear direction and execution alignment."],
          ["", "Completed moving current and existing POCs to OpenShift."],
          ["", "Continued assessing and creating automated testing procedures for LLM projects."],
          ["", "Started creating a testing suite of applications and questions for the Judiciary Guide using Garak and DeepEval."]
        ],
        planned: [
          ["", "Continue deploying the JEFS internal site to Azure Kubernetes Service as proof of concept and cloud cost evaluation."],
          ["", "Continue development of the InfoWeb Support Guide Chatbot, focusing on usability and integration with existing documentation."],
          ["", "Continue refinement of the Online Judicial Guide in alignment with AO priorities."],
          ["", "Continue working with AO leadership to define and formalize the operating model."],
          ["", "Continue creating a testing suite of applications and questions for the Judiciary Guide using Garak and DeepEval."],
          ["", "Continue assessing and creating automated testing procedures for LLM projects."]
        ],
        staffing: [["Service Delivery","Kenneth Megill","10/7/2024","Business Analyst - Senior"],["Service Delivery","Louden Motina","4/1/2025","Enterprise Architect"],["Service Delivery","Jason De Kock","10/7/2024","Systems Integration Engineer"],["Service Delivery","Louie Chen","11/12/2024","AI Engineer"],["Service Delivery","Syed Abbas","8/11/2025","Information Assurance Engineer"],["Service Delivery","Dhruvi Rathod","8/14/2025","Information Assurance Engineer"]],
        issues: ["Operating model and decision alignment across AO and TechSur remain in definition as part of the ongoing leadership transition. Resolution: continue regular engagement with TechSur and AO leadership on a shared operating model that defines direction, decision-making, and execution expectations."],
        risks: ["TSO cloud capabilities are still maturing and may not yet fully support all targeted innovation use cases. Mitigation: continue aligning development efforts to currently available TSO services while informing a multi-cloud strategy."],
        travel: "N/A"
      },
      "Call 16.1": {
        title: "Call Order 016 – RAE Support",
        funding: [["Funds Obligated", 3383404.80], ["Funds Expended to Date", 533577.96], ["Funds Remaining", 2849826.84], ["Estimate at Completion", 3260861.72], ["Over/Under", 122543.08]],
        completed: [
          ["Project Management & PMO Support", "Provided PMO support to TSIO, including PM process improvement workshops, contract deliverable verification, project inventory assessment, and ongoing PM guidance. Continued PM support for the Sealed Document Security (SDS) Project. Provided PM support for the ETSD AI Strategy Initiative, AI Gateway, and Courtroom Technology. Began onboarding new Agile Coach resource, Ram Dasari."],
          ["Governance, Security & Vulnerability Management", "Conducted daily monitoring and analysis of vulnerability reports and tracked remediation of critical and high-risk findings. Eliminated false-positive vulnerability plugin IDs from Splunk reporting. Coordinated installation of missing Nessus agents. Partnered with DevSecOps and Development teams to remediate JDK vulnerabilities. Addressed asset inventory discrepancies including CSAM ID corrections and CMDB updates. Developed and refined Vulnerability Management Policy and SOP documentation. Delivered Azure Minimum Controls guidance and completed JSIF/Azure control mapping."],
          ["DevSecOps & Automation", "Implemented Git event-based deployment pipelines supporting automated deployments across Development, Staging, and Production. Established deployment workflows aligned with organizational branching and release management strategies. Completed Infrastructure as Code assessment for VMware environments, including Terraform and Ansible implementation guidance. Researched automated internal certificate renewal processes."],
          ["Cloud & Platform Support", "Continued support for TSO and COO teams with cloud development activities and access control management."],
          ["Courtroom Technology Support", "Supported FY25 Judiciary-wide data collection analysis and reporting. Assisted with AVoIP courtroom design reviews and stakeholder engagement. Supported development and maintenance of Courtroom Technology SharePoint sites. Participated in the Courtroom Technology Conference and continued administration of the Judiciary's AVIXA membership program."]
        ],
        planned: [
          ["Project Management & PMO Support", "Continue PMO support for TSIO, including project process improvements and Jira process alignment. Continue PM support for the ETSD AI Strategy initiative, AI Portal Project, and Courtroom Technology."],
          ["Security & Vulnerability Management", "Monitor Nessus agent deployment status and coordinate remediation of remaining gaps. Continue tracking and driving remediation of critical, high, and aging vulnerabilities. Enhance Splunk reporting and validate new asset dashboard data. Continue vulnerability trend analysis, POA&M tracking, and documentation development. Support Azure Landing Zone planning."],
          ["DevSecOps & Automation", "Evaluate Dockerfile security scanning tools and recommend a standardized enterprise solution. Implement Cosign for container image signing within CI/CD pipelines. Document container security scanning processes. Expand CI/CD deployment capabilities across OpenShift, Azure, and AWS, and validate multi-cloud deployment workflows."],
          ["Cloud & Platform Support", "Continue supporting TSO and COO teams with cloud development, platform administration, and access management activities."],
          ["Courtroom Technology Support", "Continue FY25 data analysis and preparation of Judiciary-wide reporting deliverables. Support completion of AVoIP courtroom design reviews and comment resolution. Continue development of Courtroom Technology SharePoint sites. Continue administration and support of the Judiciary's AVIXA program."],
          ["Enterprise Architecture (support for Call Order 002)", "See Call Order 002."],
          ["Service Delivery (support for Call Order 013)", "See Call Order 013."]
        ],
        staffing: [["Business Ops","Paul Schomburg","9/15/2024","Agile Coach/Consultant — CO 16"],["Business Ops","Parag Matalia","8/12/2024","Agile Consultant — CO 16"],["Business Ops","Ram Dasari","6/29/2026","Agile Consultant — CO 16"],["Business Ops","Jessica Murphy","9/19/2022","Admin Support Specialist — CO 16"],["Business Ops","Andrew Camp","7/1/2023","Project Manager — CO 16"],["Business Ops","Darren Boykin","7/28/2025","Information Systems Eng — CO 16"],["Business Ops","Dora Mensah","5/12/2025","Cyber Threat Analyst — CO 16"],["Business Ops","Benjamin Eseku","5/19/2025","Cyber Threat Analyst — CO 16"],["Business Ops","Pat Shubird","10/1/2025","Systems Engineer — CO 16"],["Business Ops","Prathyusha Gaddam","10/14/2025","Information Systems Eng — CO 16"],["Service Delivery","Joseph Lee","9/26/2022","Systems Engineer — CO 16"],["Service Delivery","Hao Ray Duong","2/20/2024","Cloud Architect — CO 16"],["Business Ops","Pankaj Shishodia","6/9/2025","Agile Coach — CO 16"],["Enterprise Arch","Shamroze Niazi","9/26/2022","Enterprise Architect — CO 02"],["Enterprise Arch","Deloy Johnson","2/26/2023","Systems Engineer — CO 02"],["Service Delivery","Nick Sundar","12/4/2023","Enterprise Architect — CO 13"]],
        issues: [], risks: [], travel: "N/A"
      },
      "Call 17": {
        title: "Call Order 017 – Enterprise IT Project Management",
        funding: [["Funds Obligated", 1681420.80], ["Funds Expended to Date", 967686.39], ["Funds Remaining", 713734.41], ["Estimate at Completion", 1611599.59], ["Over/Under", 69821.21]],
        completed: [
          ["", "Published the June edition of The Agile Pulse Newsletter, continuing regular communications to promote Agile awareness across the AO."],
          ["", "Conducted design sessions to define Level 1 of the enterprise Agile training curriculum, establishing the foundation for standardized learning pathways."],
          ["", "Demonstrated the Learning Hub SharePoint site to the EPMB Branch Chief, highlighting a centralized platform for training materials and resource access."],
          ["", "Facilitated FY26 Q4 CIO IT Major Project Review presentation training sessions and initiated pre-brief sessions with Program and Project Managers."],
          ["", "Advanced the ITPM Framework draft for CIO and Chief of Staff review."],
          ["", "Prepared a draft of the Judiciary Guidelines for Implementing Agile Projects for EPMB Chief review, aligned with the PMBOK v8 framework."],
          ["", "Developed a draft Project Charter Template and accompanying Instruction Guide to support standardized project initiation practices."],
          ["", "Continued standardization of EPMB project management templates and tools, reducing duplication and improving consistency."],
          ["", "Completed FY26 EPMB Q4 planning, including strategic priorities, timeline alignment, resource coordination, and accountability measures."],
          ["", "Refined the Program and Project Management Community of Practice (CoP) Establishment Outline in preparation for leadership review."]
        ],
        planned: [
          ["", "Continue development and refinement of the enterprise Agile training curriculum and define subsequent training levels and learning pathways."],
          ["", "Incorporate leadership feedback and advance the Learning Hub SharePoint site toward broader implementation and adoption."],
          ["", "Complete pre-brief sessions and provide ongoing support for FY26 Q4 CIO IT Major Project Reviews."],
          ["", "Facilitate review cycles and incorporate stakeholder feedback into the ITPM Framework for finalization."],
          ["", "Advance the Judiciary Guidelines for Implementing Agile Projects through leadership review and comment resolution."],
          ["", "Finalize and socialize the Project Charter Template and Instruction Guide for broader EPMB adoption."],
          ["", "Continue consolidation and standardization of EPMB project management templates, tools, and artifacts."],
          ["", "Execute the FY26 Q4 work plan and monitor progress against established priorities and milestones."],
          ["", "Present the Program and Project Management Community of Practice outline to EPMB and EPSD leadership."],
          ["", "Prepare and publish the July edition of The Agile Pulse Newsletter."]
        ],
        staffing: [["Portfolio Mngt","Taiwo Adenuga","8/5/2024","Project Manager"],["Portfolio Mngt","Patti April","10/28/2024","Senior Agile Consultant"],["Portfolio Mngt","Bob Carpenter","3/27/2023","Agile Coach"],["Portfolio Mngt","Natalee Savage","7/24/2023","Agile Coach"],["Portfolio Mngt","Amir Bawani","1/13/2025","Agile Coach"],["Portfolio Mngt","Dipika Jain","11/1/2023","Agile Coach"],["Portfolio Mngt","Samrah Kashif","2/17/2026","Senior Agile Consultant"],["Portfolio Mngt","James Rader","9/23/2024","Senior Agile Consultant"]],
        issues: [], risks: [], travel: "N/A"
      },
      "Call 18": {
        title: "Call Order 018 – Zero Trust Architecture",
        funding: [["Funds Obligated", 2000000.00], ["Funds Expended to Date", 953984.81], ["Funds Remaining", 1046015.19], ["Estimate at Completion", 1897591.29], ["Over/Under", 102408.71]],
        completed: [
          ["", "Completed the structured analysis of interview data for Group 3, expanding As-Is documentation, deepening the Gap Analysis, and refining the list of Zero Trust initiatives for the Application and Workload, Data, and Automation and Orchestration pillars, as well as the cross-cutting capabilities for Visibility and Analytics. Completed cost-benefit scoring and prioritization, enabling data-driven recommendations that inform the Zero Trust Architecture, Roadmap, and Policy deliverables."],
          ["", "Continued maturing the Zero Trust Roadmap Document, working closely with government partners to refine structure, visuals, and content for the separate volumes on the Devices and Network pillars. Incorporated feedback from TSIO members, other SMEs, and the CIOWG."],
          ["", "Completed the second incremental delivery of the working draft of policies and standards scoped to the Devices and Network pillars, including recommendations for Judicial policy, AO manual, standards, and SOPs."],
          ["", "Expanded the Zero Trust Architecture SharePoint site, strengthening the program's communications and change-management capability by incrementally adding content."]
        ],
        planned: [
          ["", "Incorporate feedback for the analysis documents, completing the As-Is documentation, the Gap Analysis, and the list of Zero Trust initiatives for the Application and Workload, Data, Visibility and Analytics, and Automation and Orchestration pillars."],
          ["", "Deliver the final incremental version of the Zero Trust Roadmap Document for government review, including the main document, all five CISA ZTMM pillars, and the two cross-cutting capabilities."],
          ["", "Deliver the third incremental working draft of policies and standards scoped to the Data and Application and Workload pillars."],
          ["", "Deliver final versions of the RACI, Change Management Plan, and Risk Register for government review."],
          ["", "Continue to expand the Zero Trust Architecture SharePoint site."]
        ],
        staffing: [["Service Delivery","Shawn Faunce","10/6/2025","Agile Coach / Consultant"],["Service Delivery","Nat Iyer","10/14/2025","Cloud Architect"],["Service Delivery","David Prompovitch","10/14/2025","Data Scientist"],["Service Delivery","Mary Raguso","10/8/2025","Information Systems Engineer"],["Service Delivery","Megan Giesy","10/8/2025","Agile Coach / Consultant"],["Service Delivery","Tapan Rath","12/29/2025","Cloud Architect"],["Service Delivery","GyVonda McCain","2/9/2026","Systems Integration Engineer"]],
        issues: [], risks: [], travel: "N/A"
      }
    }
  }
];

