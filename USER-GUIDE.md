# Contract Transparency Portal - User Guide

**Quick reference guide for all users**

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Customer Guide](#customer-guide)
3. [Project Manager Guide](#project-manager-guide)
4. [Program Manager Guide](#program-manager-guide)
5. [Administrator Guide](#administrator-guide)
6. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Understanding Your Role

The portal has different interfaces for each user role:

| Role | Navigation Tabs | Primary View | Authentication |
|------|----------------|--------------|----------------|
| **Customer** | ✅ Has tabs (Call Orders, Weekly Reports, Monthly Reports) | Full transparency - sees all data | Email/Password |
| **Project Manager (PM)** | ❌ No nav tabs | Simplified call orders list (assigned only) | Microsoft SSO |
| **Program Manager** | ✅ Has tabs (Call Orders, Weekly Reports, Monthly Reports, Manage Customers) | Full access + customer management | Microsoft SSO |
| **Administrator** | ✅ Has tabs (Call Orders, Weekly Reports, Monthly Reports, Admin) | Full system access + user management | Email or SSO |

**Key Difference:** Project Managers see a simplified interface with **no navigation tabs**. They see only their assigned call orders and create reports within each call order's detail page.

### Accessing the Portal

1. Open your web browser
2. Navigate to: `https://your-portal-domain.com`
3. You'll see the login page with two options:
   - **Email/Password** - For customers and some administrators
   - **Sign in with Microsoft** - For TechSur staff (PMs, Program Managers)

### First-Time Login (Customers Only)

If you received a temporary password:

1. Enter your **email address**
2. Enter the **temporary password** provided to you
3. Click **Login**
4. You'll be prompted to change your password
5. Create a new password that meets these requirements:
   - At least 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
   - At least one special character (!@#$%^&*)
6. Click **Change Password**
7. You'll be logged into the portal

---

## Customer Guide

**Role:** External customer with read-only access to all contract data

### How to Login

**Option 1: Email/Password**
1. Go to the login page
2. Enter your email address
3. Enter your password
4. Click **Login**

### What You Can See

As a customer, you have **automatic access** to view:
- ✅ All 10 call orders
- ✅ All weekly status reports
- ✅ All monthly status reports

No assignments needed - everything is visible to you automatically.

### Viewing Call Orders

**Step 1: Navigate to Call Orders**
- After login, you'll see the **Call Orders** tab (automatically selected)
- You'll see a table with all active call orders

**Step 2: Understanding the Call Order List**

The table shows:
- **Call Order** - ID number (e.g., Call 2.1, Call 2.3)
- **Group** - Group name
- **Status** - Current status
- **PM** - Project Manager name
- **Vendor** - Vendor name
- **POC** - Point of contact
- **Period of Performance** - Contract dates
- **Funded** - Total funded amount
- **Spend** - Amount spent to date
- **Remaining** - Remaining funds

**Step 3: View Call Order Details**
1. Click on any call order row
2. You'll see detailed information in three tabs:

**Financials Tab:**
- Budget summary
- Spending vs. funded amounts
- Estimate at Completion (EAC)
- Variance analysis

**People Tab:**
- Staff roster with names and roles
- FTE (Full-Time Equivalent) counts
- Active, vacant, and departed personnel

**Reports Tab:**
- Weekly touchpoint reports for this call order

### Viewing Weekly Status Reports

**Step 1: Go to Weekly Status Reports**
1. Click the **Weekly Status Reports** tab in the top navigation

**Step 2: View Consolidated Reports**
- You'll see a **consolidated view** of all weekly reports submitted by Project Managers
- Reports are organized by week in an accordion format
- Each week shows:
  - Week ending date
  - Progress circle (indicating completion status)
  - Number of call orders with reports

**Step 3: Expand a Week**
1. Click on any week to expand it
2. You'll see accomplishments grouped by call order:
   - **Call Order name**
   - List of accomplishments for that week
   - Dashboard references
   - Technical progress updates
3. This gives you a complete picture of all work across all call orders for that week

**Step 4: Filter and Search**
- Use the date range picker to filter by time period
- Search for specific keywords in accomplishments
- Reports are sorted by most recent first

### Viewing Monthly Status Reports

**Step 1: Go to Monthly Status Reports**
1. Click the **Monthly Status Reports** tab

**Step 2: View Report List**
- You'll see all submitted monthly reports
- Each report shows:
  - Month and year
  - Submission date
  - Status (Submitted to Customer)

**Step 3: View Report Details**
1. Click on any report to view
2. You'll see sections for:
   - Funding information
   - Monthly activity
   - Staffing updates
   - Issues and risks

**Step 4: Download Reports**
- Click the **Download** button to save as PDF or Word document

### Logging Out

1. Click your name in the top right corner
2. Click **Logout**

---

## Project Manager Guide

**Role:** TechSur staff managing specific call orders, using Microsoft SSO

**Important:** Project Managers have a simplified interface with **no navigation tabs** - you see only your assigned call orders and work within each call order.

### How to Login

**Microsoft Single Sign-On (SSO)**
1. Go to the login page
2. Click **Sign in with Microsoft**
3. Enter your **TechSur email** (e.g., alex.johnson@techsur.com)
4. Enter your **Microsoft password**
5. Complete MFA (multi-factor authentication) if prompted
6. You'll be logged in and see your assigned call orders

**Note:** You do NOT need a separate portal password - your Microsoft credentials are used.

### What You Can See

As a Project Manager, you have access to:
- ✅ **Call orders assigned to you** - Filtered list showing only your assignments
- ✅ **Call order details** - View Financials, People, and Weekly Status Reports tabs
- ✅ **Create weekly reports** - Within each call order's "Weekly Status Reports" tab

**You do NOT see:**
- ❌ Navigation tabs (no top-level tabs)
- ❌ Other project managers' call orders
- ❌ Program-level consolidated weekly reports
- ❌ Monthly Status Reports
- ❌ Admin or user management

### Your Call Orders View

After login, you'll see a **simplified call orders list**:

**What You See:**
- Only the call orders assigned to you by the Administrator
- Call order ID, period of performance, people count, funding, and spend
- No upload button or admin features
- No navigation tabs at the top

**Why It's Different:**
- Your interface is streamlined to focus on your assigned work
- You don't need to navigate between different top-level sections
- Everything you need is within your assigned call orders

### Creating Weekly Status Reports

**Step 1: Open a Call Order**
1. From your call orders list, click on the call order you want to report on
2. You'll see the call order detail page

**Step 2: Go to Weekly Status Reports Tab**
1. In the call order detail page, you'll see three tabs:
   - **Financials** - Budget and spending data
   - **People** - Staff roster
   - **Weekly Status Reports** - Your reporting area ← Click this
2. This tab is **only visible to Project Managers** - other roles use top navigation

**Step 3: Create a New Weekly Report**
1. In the "Weekly Status Reports" tab, click **+ Create Weekly Report**
2. The week ending date is automatically set (most recent Sunday)
3. Your name is pre-filled as the submitter
4. The system ensures **one report per week per call order**

**Step 4: Add Accomplishments**
1. In the report form, enter your accomplishments in the text area
2. Add one accomplishment per line
3. Optionally add:
   - Planned activities
   - Risks
   - Issues
   - Actions
4. The form auto-saves every 3 seconds as you type

**Step 5: Save or Submit**
- **Save as Draft** - Keep working on it later
- **Submit** - Make it visible to Program Managers and customers
- **Edit after submission** - You can still edit and resubmit if needed

**Step 6: View Your Past Reports**
1. All reports for this call order appear in the list below the form
2. Click any report to edit it
3. Reports show status: Draft, Submitted, or Uploaded

### Viewing Financials and People

**Within Each Call Order:**

When you click on a call order, you can view two additional tabs:

**1. Financials Tab:**
- Total funding and spending
- Estimate at Completion (EAC)
- Budget variance
- Burn rate
- **Note:** You can view but not edit financial data

**2. People Tab:**
- Staff roster with names and roles
- FTE (Full-Time Equivalent) counts
- Active, vacant, and departed personnel
- Staff status and dates
- **Note:** You can view but not edit staffing data

**Navigation:**
- Click the **← All call orders** link at the top to return to your call orders list
- Switch between tabs to view different aspects of the call order
- The "Weekly Status Reports" tab is where you'll spend most of your time

### Working with Multiple Call Orders

**If You Have Multiple Assignments:**

1. **Return to call orders list**: Click the **← All call orders** link
2. **Select another call order**: Click on a different call order from your list
3. **Repeat the process**: Create weekly reports for each assigned call order

**Best Practice:**
- Create weekly reports for all your assigned call orders
- Submit reports on time (typically by end of week)
- Keep accomplishments concise and clear
- Update drafts regularly to avoid losing work

### Logging Out

1. Click your name in the top right corner
2. Click **Logout**

---

## Program Manager Guide

**Role:** TechSur staff managing all call orders, creating monthly reports, managing users

### How to Login

**Microsoft Single Sign-On (SSO)**
1. Go to the login page
2. Click **Sign in with Microsoft**
3. Enter your TechSur email
4. Enter your Microsoft password
5. Complete MFA if prompted
6. You'll be logged into the portal

### What You Can See

As a Program Manager, you have **full access** to:
- ✅ All call orders
- ✅ All weekly status reports
- ✅ All monthly status reports
- ✅ User management (customers and project managers)

### Navigation Tabs

After login, you'll see:
- **Call Orders** - View all 10 call orders
- **Weekly Status Reports** - View all submitted reports (consolidated from all PMs)
- **Monthly Status Reports** - Create and manage program-level monthly reports
- **Manage Customers** - Add and manage customer accounts

---

### Managing Call Orders

**Viewing Call Orders**
1. Click the **Call Orders** tab
2. You'll see all call orders in a table
3. Click any call order to view details (Financials, People, Reports)

**Understanding Call Order Data**
- All financial data is read-only
- Staff rosters show current assignments
- Reports tab shows weekly reports from Project Managers

---

### Managing Weekly Status Reports

**Viewing All Weekly Reports**
1. Click the **Weekly Status Reports** tab
2. You'll see an **accordion dashboard** with all weeks organized chronologically
3. Each week shows:
   - Week ending date
   - Progress circle (green = reports submitted, gray = no reports)
   - Number of call orders with reports that week

**Using the Accordion View**
1. Click any week to expand and see all accomplishments
2. Accomplishments are grouped by call order
3. You can see which PMs submitted reports and which didn't
4. This consolidated view shows all PM activity for the week

**Filtering and Searching**
- Use date range picker to filter by time period
- Search by call order name or accomplishment keywords
- Export data for analysis if needed

**Your Role:**
- Review weekly reports for accuracy and completeness
- Follow up with PMs who haven't submitted reports
- Use this data to compile program-level monthly status reports

---

### Creating Monthly Status Reports

**Step 1: Navigate to Monthly Reports**
1. Click the **Monthly Status Reports** tab
2. You'll see a list of existing monthly reports

**Step 2: Create a New Report**
1. Click **+ Create Monthly Report**
2. Select the month and year
3. Click **Create**

**Step 3: Add Report Sections**
1. In the report editor, add sections:
   - **Funding** - Financial summary
   - **Activity** - Monthly highlights
   - **Staffing** - Personnel updates
   - **Travel** - Travel information
   - **Issues** - Risks and issues
   - **Accomplishments** - Key achievements

2. For each section:
   - Click **+ Add Section**
   - Select section type
   - Enter content
   - Select relevant call orders

**Step 4: Auto-Populate Data**
- The system can auto-populate funding data from call orders
- Click **Import Funding Data** to pull current financials

**Step 5: Save or Submit**
- **Save Draft** - Save your progress
- **Submit to Customer** - Finalize and make visible to customers
  - Once submitted, customers can view the report
  - You can still edit after submission

**Step 6: Download Reports**
- Click **Download** to export as PDF or Word document
- Use for email distribution or archival

**Step 7: Resubmit After Edits**
- If you edit a submitted report, click **Resubmit** to update the customer view

---

### Managing Customers

As a Program Manager, you can create and manage **customer accounts only**.

**Note:** You CANNOT create Project Manager accounts. Project Manager accounts are created by Administrators.

**Step 1: Navigate to Customer Management**
1. Click the **Manage Customers** tab
2. You'll see a list of all customer accounts

---

#### Creating a Customer Account

**Step 1: Add New Customer**
1. Click **+ Invite Customer**
2. The customer form opens

**Step 2: Enter Customer Information**
1. **Email:** Enter customer's email address
2. **Name:** Enter full name
3. **Role:** Automatically set to **Customer** (you cannot change this)
4. You'll see a blue info box: "Creating Customer Account - A temporary password will be generated. The customer must change it on first login."

**Step 3: Save**
1. Click **Save**
2. A dialog appears with the **temporary password**
3. **IMPORTANT:** Copy this password immediately - it's shown only once!

**Step 4: Share Credentials**
1. Send the customer their email and temporary password via secure method
2. Tell them they must change the password on first login

**What Customers Get:**
- ✅ Automatic access to ALL call orders (no assignment needed)
- ✅ Read-only access to all weekly and monthly reports
- ✅ Email/password authentication
- ✅ Full transparency into all contract data

---

#### Editing Customer Accounts

**Step 1: Find the Customer**
1. In the customer list, find the customer you want to edit
2. Click the **Edit** button

**Step 2: Make Changes**
- You can update the customer's **name**
- You **cannot** change their email or role
- Customers automatically have full access (no assignments to manage)

**Step 3: Save Changes**
1. Click **Save**
2. Changes take effect immediately

---

#### Resetting Customer Passwords

If a customer forgets their password:

**Step 1: Find the Customer**
1. In the user list, find the customer
2. Click **Reset Password**

**Step 2: Generate New Password**
1. A dialog appears
2. Enter a new temporary password (or generate one)
3. Click **Reset Password**

**Step 3: Share New Password**
1. Securely send the new password to the customer
2. Tell them to change it after logging in

---

#### Deleting Customer Accounts

**Warning:** Deleting a customer account is permanent!

**Step 1: Find the Customer**
1. In the customer list, find the customer
2. Click **Delete**

**Step 2: Confirm**
1. A confirmation dialog appears
2. Click **Confirm** to permanently delete
3. The customer can no longer log in

---

### Logging Out

1. Click your name in the top right corner
2. Click **Logout**

---

## Administrator Guide

**Role:** Full system access, can manage all users including Program Managers and Admins

### How to Login

**Email/Password or Microsoft SSO**
- Administrators can use either authentication method
- Follow the same login steps as customers or Project Managers

### What You Can Do

As an Administrator, you have **full access** to:
- ✅ All call orders
- ✅ All weekly and monthly reports
- ✅ All user management features
- ✅ Can create users with any role (customer, pm, program_manager, admin)
- ✅ System administration and audit logs

### User Management Differences

Unlike Program Managers (who can only manage customers), Administrators can:
- Create **Project Manager** accounts
- Create **Program Manager** accounts  
- Create **Administrator** accounts
- View **all users** in the system (including PMs, program managers, and admins)
- Set custom authentication providers for any user
- Set custom passwords for email-authenticated users
- Assign call orders to Project Managers

### Creating Users

**Note:** Administrators can create ALL user types, while Program Managers can only create customers.

**Step 1: Navigate to Admin Panel**
1. Click the **Admin** tab
2. Click **+ Add User**

**Step 2: Enter User Information**
1. **Email:** Enter email address
2. **Name:** Enter full name
3. **Role:** Select from:
   - Customer
   - Project Manager
   - Program Manager
   - Administrator

**Step 3: Set Authentication**
1. **Auth Provider:** Select **email** or **microsoft**
2. **Password:** If using email auth, set a password

**Step 4: Set Authentication**
- For **Customers**: Automatically uses email/password, temporary password generated
- For **Project Managers**: Select **Microsoft** authentication (SSO)
- For **Program Managers/Admins**: Choose email or Microsoft

**Step 5: Assign Call Orders (for PMs only)**
1. If role is **Project Manager**, scroll to Call Order Access section
2. Check boxes for call orders this PM should manage
3. PMs can only see their assigned call orders

**Step 6: Save**
1. Click **Save**
2. The user account is created
3. If creating a customer, you'll see the temporary password dialog

### Additional Admin Features

- **Audit Logs:** Track user actions and system changes
- **System Settings:** Configure portal-wide settings
- **Bulk Operations:** Import/export user data
- **Advanced Reporting:** Generate custom reports

### Creating Project Manager Accounts

**Important:** Only Administrators can create Project Manager accounts.

**Step 1: Create the PM Account**
1. Go to **Admin** → **+ Add User**
2. Enter email (must be TechSur email, e.g., @techsur.com)
3. Enter name
4. Select **Role: Project Manager**
5. Select **Auth Provider: Microsoft** (SSO)
6. **Do not set a password** - PMs use Microsoft credentials

**Step 2: Assign Call Orders**
1. In the **Call Order Access** section, check boxes for assigned call orders
2. PMs will only see these call orders in their call orders list
3. Click **Save**

**Step 3: Inform the PM**
1. Tell the PM to visit the portal URL
2. Instruct them to click **Sign in with Microsoft**
3. They log in with their TechSur email and Microsoft password
4. They'll see their assigned call orders (no navigation tabs)

### Best Practices

1. **Use Strong Passwords:** Enforce password complexity for email users
2. **Regular Reviews:** Review user accounts quarterly
3. **Least Privilege:** Only assign necessary call orders to PMs
4. **Audit Regularly:** Review audit logs for suspicious activity
5. **Backup Data:** Ensure regular database backups
6. **PM Creation:** Only create PM accounts for actual TechSur staff with SSO access

---

## Troubleshooting

### I Can't Log In

**For Email/Password Users:**
- ✅ Check your email address is spelled correctly
- ✅ Check your password (passwords are case-sensitive)
- ✅ Try resetting your password with "Forgot Password" link
- ✅ Contact your Program Manager if you need a password reset

**For Microsoft SSO Users (Project Managers):**
- ✅ Make sure you're clicking **Sign in with Microsoft** button
- ✅ Use your TechSur email address (not personal email)
- ✅ Use your Microsoft password (same as Outlook/Teams)
- ✅ Complete MFA if prompted
- ✅ Contact IT support if Microsoft login fails

### I Don't See Any Call Orders

**For Customers:**
- You should see all 10 call orders automatically on the Call Orders tab
- If you see none, contact the Program Manager

**For Project Managers:**
- You see a call orders list (without navigation tabs) immediately after login
- You see ONLY the call orders assigned to you
- If the list is empty, you have no assignments yet
- Contact the Administrator to request call order assignments (only admins can assign call orders to PMs)
- If you see call orders but can't create reports, ensure you're clicking on a call order and going to the "Weekly Status Reports" tab

### I Can't Create a Weekly Report

**For Project Managers:**
- ✅ Make sure you have call orders assigned to you (check with Administrator)
- ✅ Click on a call order from your list
- ✅ Click the "Weekly Status Reports" tab (third tab after Financials and People)
- ✅ Click "+ Create Weekly Report" button
- ✅ One report per week per call order - you may have already created one for this week
- ✅ If you don't see the "Weekly Status Reports" tab, you might be logged in as a different role
- ✅ Try refreshing the page
- ✅ Contact Administrator if issue persists

### I Can't Submit a Monthly Report

**For Program Managers:**
- ✅ Make sure all required sections are filled in
- ✅ Check for error messages in the form
- ✅ Try saving as draft first, then submit
- ✅ Refresh the page and try again

### Password Requirements Not Met

When creating a new password, it must have:
- ✅ At least 8 characters
- ✅ One uppercase letter (A-Z)
- ✅ One lowercase letter (a-z)
- ✅ One number (0-9)
- ✅ One special character (!@#$%^&*)

**Example valid password:** `Welcome2024!`

### Temporary Password Dialog Disappeared

If you closed the temporary password dialog:
- The password cannot be retrieved
- Use the **Reset Password** feature to generate a new one
- Contact the Administrator for assistance

### Microsoft SSO Not Working

**Common Issues:**
- ✅ Make sure you're using your work email (e.g., @techsur.com)
- ✅ Don't use personal Microsoft account
- ✅ Clear browser cache and cookies
- ✅ Try a different browser
- ✅ Check with IT if you need MFA setup
- ✅ Verify your account in Azure AD

### I See "Access Denied" or "Insufficient Permissions"

- You're trying to access something your role doesn't allow
- Contact your Program Manager or Administrator
- They can adjust your permissions or explain access levels

### Browser Compatibility

**Supported Browsers:**
- ✅ Google Chrome (recommended)
- ✅ Microsoft Edge
- ✅ Firefox
- ✅ Safari (Mac)

**Not Supported:**
- ❌ Internet Explorer

### Still Need Help?

**Contact Support:**

**For Customers:**
- Contact your **Program Manager** for account issues or data questions
- Contact **IT Support** for login problems

**For Project Managers:**
- Contact the **Administrator** for call order assignments or account issues
- Contact **IT Support** for Microsoft SSO or authentication problems
- Contact **Program Manager** for questions about report requirements

**For Program Managers:**
- Contact **Administrator** for system access or PM account creation
- Contact **IT Support** for technical issues

**For Administrators:**
- Contact **IT Support** for infrastructure or technical issues
- Refer to system documentation for advanced configurations

---

## Quick Reference

### Login Methods by Role

| Role | Login Method | Username | Password | Notes |
|------|-------------|----------|----------|-------|
| Customer | Email/Password | Email address | Temporary → Must change on first login | Gets temp password from Program Manager |
| Project Manager | Microsoft SSO | TechSur email (@techsur.com) | Microsoft password + MFA | No separate portal password |
| Program Manager | Microsoft SSO | TechSur email (@techsur.com) | Microsoft password + MFA | No separate portal password |
| Administrator | Email or Microsoft SSO | Email or TechSur email | Set by admin | Can use either method |

### Access Levels by Role

| Feature | Customer | Project Manager | Program Manager | Administrator |
|---------|----------|-----------------|-----------------|---------------|
| View All Call Orders | ✅ (All 10) | ✅ (Assigned only) | ✅ (All 10) | ✅ (All 10) |
| Has Navigation Tabs | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes |
| Create Weekly Reports | ❌ | ✅ (In call order tab) | ❌ | ❌ |
| View Consolidated Weekly Reports | ✅ | ❌ | ✅ | ✅ |
| Create Monthly Status Reports | ❌ | ❌ | ✅ | ✅ |
| View Monthly Status Reports | ✅ | ❌ | ✅ | ✅ |
| Manage Customers | ❌ | ❌ | ✅ | ✅ |
| Create PM Accounts | ❌ | ❌ | ❌ | ✅ Only |
| Assign Call Orders to PMs | ❌ | ❌ | ❌ | ✅ Only |

### Common Tasks

**Creating a Weekly Report (PM):**
1. Click call order → Weekly Status Reports tab → + Create → Add accomplishments → Submit

**Creating a Customer (Program Manager):**
1. Manage Customers → + Invite Customer → Enter info → Save → Copy temp password

**Creating a Project Manager (Administrator Only):**
1. Admin → + Add User → Role: PM → Auth: Microsoft → Assign call orders → Save

**Creating a Program Monthly Report (Program Manager):**
1. Monthly Status Reports → + Create → Add sections → Submit to Customer

**Resetting a Customer Password (Program Manager):**
1. Manage Customers → Find customer → Reset Password → Share new temp password

---

*For additional support or questions not covered in this guide, please contact your system administrator.*
