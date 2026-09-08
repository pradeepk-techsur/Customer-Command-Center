# Role-Based Access Control Testing Guide

## Test Accounts
All accounts use password: **Password123!**

### 1. Project Manager (Restricted Access)
**Login:** alex.johnson@techsur.com  
**Expected Behavior:**
- ✅ Role label: "(Project Manager)"
- ✅ Lands on Call Orders list showing only assigned call orders (Call 4.3, 13.1)
- ✅ Can click into each call order to view Financials, People, Weekly Status Reports tabs
- ✅ Can upload, modify, and submit weekly status reports within each call order
- ✅ Can edit Financials and People tabs for assigned call orders
- ❌ NO "Call Orders" tab in top navigation (redundant - they only see their orders)
- ❌ NO "Weekly Status Reports" tab in top navigation (access via call order tabs)
- ❌ NO "Monthly Status Reports" tab in navigation
- ❌ Cannot create or upload monthly reports

### 2. Program Manager (Full Access)
**Login:** ceenil.kaur@techsur.com  
**Expected Behavior:**
- ✅ Role label: "(Program Manager)"
- ✅ Can see all 8 call orders
- ✅ Can upload call orders
- ✅ Can edit any call order (Financials, People, Weekly Reports tabs)
- ✅ HAS "Monthly Status Reports" tab in navigation
- ✅ Can create new monthly reports (draft from portal data or blank)
- ✅ Can upload monthly report PDFs
- ✅ Can edit MSR sections for all call orders

### 3. Customer (Read-Only Access to All Data)
**Login:** john.smith@acme.com  
**Expected Behavior:**
- ✅ Role label: "(Customer)"
- ✅ Can see ALL call orders (full transparency)
- ✅ HAS "Call Orders" tab
- ✅ HAS "Weekly Status Reports" tab in top navigation (read-only list of all reports)
- ✅ HAS "Monthly Status Reports" tab in top navigation (read-only list of all reports)
- ✅ Can view all submitted weekly and monthly reports from top navigation
- ❌ NO "Weekly Status Reports" tab inside individual call orders
- ❌ NO upload button
- ❌ Cannot edit anything (no edit buttons in call orders)

**Login:** jane.doe@example.com  
**Login:** mike.wilson@demo.org

### 4. Administrator (Full Access + User Management)
**Login:** admin@techsur.com  
**Expected Behavior:**
- ✅ Role label: "(Administrator)"
- ✅ Can see all 8 call orders
- ✅ Can edit everything
- ✅ HAS "Admin" tab in navigation
- ✅ Can create/edit/delete users
- ✅ Can assign call orders to customers AND project managers
- ✅ Can manage user roles (customer, pm, program_manager, admin)

---

## Test Scenarios

### Scenario 1: Project Manager Edit Permissions
1. Login as **alex.johnson@techsur.com**
2. **Verify Landing Page:**
   - ✅ Lands on Call Orders list (register view)
   - ✅ Sees only 2 assigned call orders: MFA Support (Call 4.3), DevSecOps (Call 13.1)
   - ❌ NO top navigation tabs (clean interface focused on assigned work)
3. Click on "Multifactor Authentication (MFA) Support" call order
4. **Test Financials Tab:**
   - ✅ Should see "Update Spend" button with currency formatting
   - ✅ Can update spend amount
5. **Test People Tab:**
   - ✅ Should see "Add Staff Member" button
   - ✅ Can add/edit/remove staff
   - ❌ NO "By Labor Category" section
6. **Test Weekly Status Reports Tab:**
   - ✅ Should see "Create Report" and "Upload Reports" buttons
   - ✅ Can create weekly reports with Sunday date selector
   - ✅ Can upload report files
   - ✅ Can edit and submit reports to Program Managers

### Scenario 2: Program Manager Full Access
1. Login as **ceenil.kaur@techsur.com**
2. Click "Monthly Status Reports" tab
3. **Test MSR Creation:**
   - ✅ Should see "Create Monthly Report" button
   - ✅ Can create new report (draft or blank)
4. **Test MSR Upload:**
   - ✅ Should see "Upload Monthly Report" button
   - ✅ Can upload PDF reports
5. **Test MSR Editing:**
   - ✅ Can edit any call order section in the MSR
6. Navigate to "Call Orders" tab
   - ✅ Should see all 8 call orders
   - ✅ Can edit any of them

### Scenario 3: Customer Read-Only Access
1. Login as **john.smith@acme.com**
2. **Verify Full Transparency:**
   - ✅ Can see ALL call orders (not filtered)
   - ✅ Has "Call Orders" tab
   - ✅ Has "Weekly Status Reports" tab in top navigation
   - ✅ Has "Monthly Status Reports" tab in top navigation
3. Click on any call order (e.g., "Enterprise Architecture")
4. **Test Read-Only Call Order View:**
   - ✅ Only sees "Financials" and "People" tabs (NO "Weekly Status Reports" tab inside)
   - ❌ No "Update Spend" button
   - ❌ No "Add Staff Member" button  
   - ✅ Can view all financial and people data
5. Click "Monthly Status Reports" tab in top navigation
   - ✅ Can view list of submitted monthly reports (e.g., "June 2026")
   - ✅ Can select and view any customer-released report
   - ✅ Shows all call order sections (full transparency)
   - ❌ No "Create" or "Upload" buttons
   - ❌ Only sees reports that Program Manager has submitted to customers
6. Click "Weekly Status Reports" tab in top navigation
   - ✅ See consolidated weekly reports with week selector dropdown
   - ✅ Can select week and view all call order reports for that week
   - ✅ Can expand/collapse individual call order reports
   - ❌ No create or edit capabilities

### Scenario 4: Admin User Management
1. Login as **admin@techsur.com**
2. Click "Admin" tab
3. **Test User Creation:**
   - Click "Create New User"
   - Create a new Project Manager with email pm.test@techsur.com
   - Assign 1 call order to them
   - ✅ Should allow PM role selection
   - ✅ Should show call order assignment UI for PM
4. **Test User Editing:**
   - Edit maria.garcia@techsur.com
   - ✅ Should show her current call order assignment (1 order)
   - Add another call order to her
   - Save
5. **Test Role Changes:**
   - Edit a customer
   - Change role to "Project Manager"
   - ✅ Call order assignments should persist
   - Change role to "Program Manager"
   - ✅ Assignments should clear (full access)

### Scenario 5: MSR Access Control
1. Login as **ceenil.kaur@techsur.com** (Program Manager)
2. Create a new monthly report for "September 2026"
3. Add sections for multiple call orders
4. Logout
5. Login as **alex.johnson@techsur.com** (Project Manager)
6. Go to "Monthly Status Reports"
   - ❌ Should NOT see "Create" or "Upload" buttons
   - ❌ Should NOT be able to create new reports
7. Open the September 2026 report
8. Try to edit a section for "MFA Support" (assigned to Alex)
   - ✅ Should be able to edit this section (has call order access)
9. Try to edit a section for "EA Support" (NOT assigned to Alex)
   - ❌ Should get 403 Forbidden error

---

## Database Verification Queries

```sql
-- Check user roles
SELECT email, role FROM users ORDER BY role, email;

-- Check call order assignments
SELECT u.email, u.role, co.name as call_order 
FROM users u
JOIN user_call_orders uco ON u.id = uco.user_id
JOIN call_orders co ON co.id = uco.call_order_id
ORDER BY u.role, u.email;

-- Verify Project Managers have assignments
SELECT u.email, COUNT(uco.call_order_id) as assigned_orders
FROM users u
LEFT JOIN user_call_orders uco ON u.id = uco.user_id
WHERE u.role = 'pm'
GROUP BY u.email;

-- Verify Program Managers have NO assignments (full access)
SELECT u.email, COUNT(uco.call_order_id) as assigned_orders
FROM users u
LEFT JOIN user_call_orders uco ON u.id = uco.user_id
WHERE u.role = 'program_manager'
GROUP BY u.email;
```

---

## API Testing with curl

### Test Project Manager Access
```powershell
# Login as PM
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Body (@{email="alex.johnson@techsur.com"; password="Password123!"} | ConvertTo-Json) -ContentType "application/json"
$token = $response.accessToken

# Get snapshot (should only see 2 call orders)
Invoke-RestMethod -Uri "http://localhost:3000/api/data" -Headers @{Authorization="Bearer $token"}

# Try to create MSR (should fail with 403)
Invoke-RestMethod -Uri "http://localhost:3000/api/monthly-reports" -Method POST -Headers @{Authorization="Bearer $token"} -Body (@{period="September 2026"; mode="blank"} | ConvertTo-Json) -ContentType "application/json"
```

### Test Program Manager Access
```powershell
# Login as Program Manager
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Body (@{email="ceenil.kaur@techsur.com"; password="Password123!"} | ConvertTo-Json) -ContentType "application/json"
$token = $response.accessToken

# Get snapshot (should see all 8 call orders)
Invoke-RestMethod -Uri "http://localhost:3000/api/data" -Headers @{Authorization="Bearer $token"}

# Create MSR (should succeed)
Invoke-RestMethod -Uri "http://localhost:3000/api/monthly-reports" -Method POST -Headers @{Authorization="Bearer $token"} -Body (@{period="September 2026"; mode="blank"} | ConvertTo-Json) -ContentType "application/json"
```

---

---

## Weekly Status Reports Testing

### Scenario 6: Project Manager Weekly Report Submission
1. Login as **alex.johnson@techsur.com** (Project Manager)
2. Navigate to "Multifactor Authentication (MFA) Support" call order
3. Click "Weekly Status Reports" tab
4. Click "Create report" button
5. **Test Week Selector:**
   - ✅ Week ending dropdown shows Sunday dates only
   - ✅ Most recent Sunday is selected by default
   - ✅ Past 12 weeks are available
6. **Fill in Report:**
   - Select week ending date
   - Enter "Alex Johnson" as submitted by
   - Add accomplishments (one per line)
   - Add planned activities
   - Add risks, issues, customer actions
7. **Test Create with Two Options:**
   - ✅ See "Save as Draft" button
   - ✅ See "Submit for Review" button (primary)
   - Click "Save as Draft"
8. **Verify Draft:**
   - ✅ Report appears in list with "Draft" status
   - ✅ Status token is orange colored
   - ✅ Can click "Edit Draft" button
9. **Test Edit Draft:**
   - Click "Edit Draft" button
   - Make changes to accomplishments
   - ✅ See "Saving..." indicator after 3 seconds
   - Click "Submit for Review"
   - ✅ Status changes to "Submitted"
10. **Test Edit Submitted Report:**
   - Select a report with "Submitted" status
   - ✅ See "Edit Report" button (not grayed out)
   - Click "Edit Report"
   - Make changes to planned activities
   - ✅ Changes auto-save (watch for "Saving..." then "Saved at..." indicator)
   - Click "Update Submission"
   - ✅ Report updates IN PLACE (same position in list)
   - ✅ Report remains "Submitted" status
   - ✅ Week ending and submitted date unchanged
   - ✅ Content updated with new text
11. **Test Duplicate Prevention:**
    - Click "Create report" button again
    - ✅ If a report exists for selected week, opens existing report in edit mode
    - ✅ Cannot create duplicate reports for same week ending
12. **Test Direct Submit:**
   - Select a different call order with no reports
   - Click "Create report"
   - Fill in details
   - Click "Submit for Review" (without saving as draft first)
   - ✅ Report created and submitted in one action
   - ✅ Status shows "Submitted" immediately
13. **Verify Edit Anytime:**
   - ✅ PMs can edit reports in both "Draft" and "Submitted" status
   - ✅ Cannot edit "Uploaded" file-based reports (no edit button shown)
   - ✅ Button text changes: "Edit Draft" vs "Edit Report"
   - ✅ Submit button changes: "Submit for Review" vs "Update Submission"

### Scenario 7: Program Manager Consolidated Weekly Reports
1. Login as **ceenil.kaur@techsur.com** (Program Manager)
2. Click "Weekly Status Reports" tab in navigation
3. **Verify Summary Statistics Card:**
   - ✅ Progress circle shows completion percentage (e.g., 70%)
   - ✅ Shows "X of Y Reports Submitted" headline
   - ✅ Week ending date displayed
   - ✅ Warning badge if reports missing: "⚠️ N missing report(s)"
   - ✅ Success badge if complete: "✓ All reports submitted"
4. **Verify Accordion Sections:**
   - ✅ "✓ Submitted Reports" section with green heading and count badge
   - ✅ "⚠️ Missing Reports" section with orange heading and count badge
   - ✅ Submitted section expanded by default
   - ✅ Missing section collapsed by default with "Click to expand" hint
5. **Test Accordion Interaction:**
   - Click on "✓ Submitted Reports" header
   - ✅ Section collapses (arrow rotates)
   - Click on "⚠️ Missing Reports" header
   - ✅ Section expands to show missing call orders
   - ✅ Each missing report shows Call Order, PM, "Not submitted" badge
6. **Review Submitted Reports Table:**
   - Expand submitted section if collapsed
   - ✅ Compact table with columns: Call Order, PM, Submitted By, Date, Action
   - ✅ Shortened date format (e.g., "Sep 6")
   - ✅ "View →" link for each report
   - ✅ Clean, efficient layout with minimal vertical scrolling
7. **Test Submit to Customer:**
   - Click "Submit to Customer" button
   - ✅ Confirmation dialog appears if reports missing
   - ✅ Dialog lists missing call orders
   - Confirm submission
   - ✅ Status changes to "✓ Submitted to Customers"
   - ✅ Submit button disappears

### Scenario 8: Customer Weekly Reports View (Consolidated)
1. Login as **john.smith@acme.com** (Customer)
2. Click "Weekly Status Reports" tab
3. **Verify Consolidated View:**
   - ✅ See "Weekly Status Reports" title
   - ✅ Week selector dropdown at top with options like "Aug 23, 2026 (10 reports)"
   - ✅ First week auto-selected on load
4. **Select Week:**
   - Use dropdown to select "Aug 23, 2026"
   - ✅ Consolidated report card displays below
   - ✅ Shows "Weekly Status Report — Aug 23, 2026"
   - ✅ Shows "10 call order reports submitted"
5. **Expand Call Order Reports:**
   - ✅ All 10 call orders listed with collapse/expand arrows
   - ✅ Includes: Call 2.3, 4.3, 13.1, 13.2, 15.1, 16.1, 17, 17.1, 18, 19
   - ✅ Each shows call order name, submitted by, and submission date
   - Click on any call order header (e.g., "Multifactor Authentication (MFA) Support")
   - ✅ Expands to show report sections (Accomplishments, Planned Activities, Risks, etc.)
   - ✅ Each section shows bullet list of items
6. **Test Interaction:**
   - Click header again to collapse
   - ✅ Arrow rotates and content hides
   - Click another call order to expand
   - ✅ Can have multiple call orders expanded simultaneously
7. **Verify Read-Only:**
   - ❌ No create, edit, or submit buttons visible
   - ✅ Can view all submitted reports from all call orders
   - ✅ Simple consolidated view similar to Program Manager's view
8. **Test Multiple Weeks:**
   - Change week selector to different week
   - ✅ Consolidated report updates to show selected week's reports

### Scenario 9: Weekly Report Upload (File-based)
1. Login as **alex.johnson@techsur.com** (Project Manager)
2. Navigate to assigned call order
3. Click "Weekly Status Reports" tab
4. Click "Upload file" button
5. Select a Word or PDF document
6. **Verify:**
   - ✅ File uploads successfully
   - ✅ Appears in report list with "Uploaded" status
   - ✅ File name shown in list
   - ✅ "Open source document" link works

### Scenario 10: Cross-Role Navigation
1. **PM View (alex.johnson@techsur.com):**
   - ✅ **DEFAULT PAGE:** Call Orders list (shows only assigned: Call 4.3, 13.1)
   - ❌ NO top navigation tabs (clean, focused interface)
   - ✅ Can navigate into call orders → access Financials, People, Weekly Reports tabs inside each order
2. **Program Manager View (ceenil.kaur@techsur.com):**
   - ✅ **DEFAULT PAGE:** Call Orders (shows all 10 call orders) at top level)
   - ❌ NO "Weekly Status Reports" tab inside individual call orders (only Financials, People)
   - ✅ HAS "Monthly Status Reports" tab
3. **Customer View (john.smith@acme.com):**
   - ✅ **DEFAULT PAGE:** Call Orders (shows ALL call orders - full transparency)
   - ✅ HAS "Call Orders" tab
   - ✅ HAS "Weekly Status Reports" tab in top navigation (list of all reports to choose from)
   - ✅ HAS "Monthly Status Reports" tab in top navigation (list of all reports to choose from)
   - ❌ NO "Weekly Status Reports" tab inside individual call orders (only Financials, People
   - ✅ HAS "Weekly Status Reports" tab (read-only view of all submitted reports)
   - ✅ HAS "Monthly Status Reports" tab (read-only view of all submitted reports)

---

## Success Criteria

### ✅ All roles work correctly:
- [x] Project Managers see only assigned call orders
- [x] Project Managers can edit their assigned call orders
- [x] Project Managers CANNOT create/upload monthly reports
- [x] Project Managers CAN create/upload weekly reports for assigned call orders
- [x] Project Managers CAN select week ending dates (Sundays only)
- [x] Program Managers see all call orders
- [x] Program Managers can create/upload monthly reports
- [x] Program Managers CAN view consolidated weekly reports
- [x] Program Managers CAN submit weekly reports to customers
- [x] Customers have read-only access to ALL call orders (full transparency)
- [x] Customers CAN view all submitted weekly reports (read-only)
- [x] Customers CAN view all submitted monthly reports (read-only)
- [x] Admins can assign call orders to both customers AND project managers
- [x] Role labels display correctly in UI
- [x] Navigation tabs show/hide based on role permissions

### ✅ Weekly Reports Features:
- [x] Week selector shows Sundays only (past 12 weeks)
- [x] Draft/submit workflow for PMs
- [x] Auto-save with 3-second debounce
- [x] Consolidated view for Program Managers
- [x] Missing reports detection and warning
- [x] Submit to customer functionality
- [x] Customer read-only view with week navigation
- [x] File upload support (Word/PDF)

### ✅ Data Integrity:
- [x] 2 Program Managers (ceenil.kaur@techsur.com, lauryn.brown@techsur.com)
- [x] 2 Project Managers with assignments (alex.johnson@techsur.com, maria.garcia@techsur.com)
- [x] 5 Customers (3 with assignments, 2 without)
- [x] 1 Admin (admin@techsur.com)
