# FRONTEND UI/UX DOCUMENTATION
## Dairy Milk Subscription and Product Booking Application

**Application Name:** YaduONE (MilkFresh)  
**Platform:** Flutter Mobile Application (iOS & Android)  
**Design Language:** Material Design 3 with Custom Premium Theme

---

## TABLE OF CONTENTS

1. [Overall Structure & User Journey](#1-overall-structure--user-journey)
2. [Design System](#2-design-system)
3. [Navigation System](#3-navigation-system)
4. [Page-by-Page Breakdown](#4-page-by-page-breakdown)
5. [Reusable Components](#5-reusable-components)
6. [UX Flow Details](#6-ux-flow-details)
7. [Responsive Behavior](#7-responsive-behavior)
8. [Friction Points & Recommendations](#8-friction-points--recommendations)

---

## 1. OVERALL STRUCTURE & USER JOURNEY

### App Flow Architecture

```
[App Launch]
    ↓
[Onboarding] (first-time only)
    ↓
[Login Screen] → [OTP Verification]
    ↓
[Profile Complete?] → NO → [Complete Profile Screen]
    ↓ YES
[Home Screen with Bottom Navigation]
    ├── Home Tab (Dashboard)
    ├── Reports Tab
    ├── Cart Tab (Tomorrow's Delivery)
    └── Profile Tab
```

### Primary User Journeys

**Journey 1: New User Onboarding**
1. Launch app → View onboarding slides (3 screens)
2. Skip or complete onboarding
3. Enter phone number → Receive OTP → Verify
4. Complete profile (name, area, address)
5. Land on Home Dashboard

**Journey 2: Subscribe to Daily Milk**
1. From Home → Tap "Start Subscription" or "Manage Subscription"
2. Select milk type (Cow/Buffalo/Mixed)
3. Choose daily quantity (0.5L - 10L in 0.5L increments)
4. Select delivery slot (Morning/Evening/Both)
5. Pick start date
6. Confirm subscription

**Journey 3: Order Extra Products**
1. From Home → Tap "Browse Products" banner OR navigate to Cart tab
2. Browse products by category (Curd, Paneer, Ghee, etc.)
3. Tap product → View details → Select quantity
4. Add to tomorrow's cart
5. Review cart → Modify milk quantity or skip delivery if needed

---

## 2. DESIGN SYSTEM

### Color Palette

**Primary Colors:**
- Primary: `#3B9BD9` (Sky Blue) - Main brand color
- Primary Dark: `#2B7BB9` - Darker shade for gradients
- Primary Light: `#E8F4FD` - Light backgrounds and highlights

**Background Colors:**
- Scaffold Background: `#F8FBFF` (Very light blue-white)
- Card Background: `#FFFFFF` (Pure white)
- Surface Background: `#F0F6FF` (Light blue tint)

**Text Colors:**
- Text Primary: `#1A1D26` (Near black)
- Text Secondary: `#6B7280` (Medium gray)
- Text Hint: `#9CA3AF` (Light gray)

**Status Colors:**
- Success: `#34C759` (Green)
- Warning: `#FF9500` (Orange)
- Error: `#FF3B30` (Red)

**Border & Divider:**
- Border: `#E5E7EB` (Light gray)
- Divider: `#F3F4F6` (Very light gray)

### Typography

**Font Family:** System default (San Francisco on iOS, Roboto on Android)

**Font Weights & Sizes:**
- Display/Hero: 26-28px, Weight 800, Letter spacing -0.3 to -0.5
- Title: 20-24px, Weight 700-800
- Heading: 16-18px, Weight 600-700
- Body: 14-15px, Weight 400-500
- Caption: 12-13px, Weight 500-600
- Label: 11-12px, Weight 700, Letter spacing 0.5-1.0, UPPERCASE

### Spacing System

**Padding/Margin Scale:**
- 4px: Micro spacing
- 8px: Small spacing
- 12px: Medium spacing
- 16px: Standard spacing
- 20px: Large spacing
- 24px: Extra large spacing
- 28px: Section spacing
- 32px: Major section spacing

### Border Radius

- Small: 8-10px (chips, badges)
- Medium: 12-14px (buttons, inputs, small cards)
- Large: 16-20px (cards, containers)
- Extra Large: 24-28px (modals, bottom sheets)
- Circular: 50% (avatars, FAB)

### Elevation & Shadows

**Premium Card Shadow:**
- Color: Primary color with 12-20 alpha
- Blur: 16-24px
- Offset: (0, 4-8px)

**Button/Icon Shadow:**
- Color: Primary color with 10-22 alpha
- Blur: 12-20px
- Offset: (0, 2-6px)

### Button Styles

**Elevated Button (Primary CTA):**
- Background: Primary color
- Foreground: White
- Height: 52-54px
- Border radius: 14-16px
- Font: 15-16px, Weight 600-700
- Full width by default

**Outlined Button (Secondary):**
- Border: Primary color, 1.5px
- Foreground: Primary color
- Height: 44-52px
- Border radius: 14px
- Background: Transparent

**Text Button:**
- Foreground: Primary color
- Font: 14px, Weight 600
- No background or border

### Input Fields

- Background: Surface background color
- Border: None (filled style)
- Border radius: 14px
- Padding: 16px horizontal, 16px vertical
- Focus border: Primary color, 1.5px
- Error border: Error color, 1px
- Hint text: Text hint color, 15px
- Label: Text secondary color, 14px

---

## 3. NAVIGATION SYSTEM

### Bottom Navigation Bar (Custom Curved Design)

**Visual Structure:**
```
┌─────────────────────────────────────────────────┐
│                                                 │
│  Reports    Cart    [HOME FAB]    Live  Profile│
│                                                 │
└─────────────────────────────────────────────────┘
```

**Layout Details:**
- Height: 56px + safe area
- Background: White with custom curved path
- Center cutout: 38px radius for FAB
- Elevation: 0 (uses custom shadow)

**Navigation Items:**
1. **Reports** (Left)
   - Icon: `insights_rounded`
   - Label: "Reports"
   - Active state: Primary color background circle + primary icon
   - Inactive: Hint color icon

2. **Cart** (Left-center)
   - Icon: `shopping_bag_rounded`
   - Label: "Cart"
   - Same active/inactive states

3. **Home FAB** (Center, elevated)
   - Icon: `home` (Cupertino style)
   - Background: Primary color
   - Shape: Circle (FloatingActionButton)
   - Elevation: 4
   - Position: Overlaps navbar, centered

4. **Live** (Right-center)
   - Icon: `live_tv_rounded`
   - Label: "Live"
   - Opens livestream screen (not a tab)

5. **Profile** (Right)
   - Icon: `person` (Cupertino style)
   - Label: "Profile"
   - Same active/inactive states

**Interaction:**
- Tap switches between tabs (0=Home, 1=Reports, 2=Cart, 3=Profile)
- Live button navigates to separate screen
- Smooth transitions with no animation delay

---

## 4. PAGE-BY-PAGE BREAKDOWN

### 4.1 ONBOARDING SCREEN

**Purpose:** Introduce app value proposition to first-time users

**Layout Structure:**
```
┌─────────────────────────────────────┐
│ [Skip Button - Top Right]           │
│                                     │
│         [Large Icon Circle]         │
│                                     │
│         Bold Title Text             │
│                                     │
│      Subtitle Description           │
│                                     │
│     ┌─────────────────────┐        │
│     │   Quote Card with   │        │
│     │   Icon & Attribution│        │
│     └─────────────────────┘        │
│                                     │
│         • • • (Dots)                │
│                                     │
│     [Next/Get Started Button]       │
│                                     │
└─────────────────────────────────────┘
```

**Element Details:**

1. **Skip Button** (Top Right)
   - Position: 12px from top, 20px from right
   - Style: TextButton
   - Text: "Skip", 15px, Weight 500, Hint color

2. **Icon Circle** (Center)
   - Size: 140x140px
   - Background: Primary light color
   - Shape: Circle
   - Icon: 64px, Primary color
   - Icons vary per page: water_drop, verified, local_shipping

3. **Title** (Below icon, 44px gap)
   - Alignment: Center
   - Font: 28px, Weight 800, Letter spacing -0.5
   - Color: Text primary
   - Examples: "Pure Milk, Daily", "100% Authentic", "Delivered Fresh"

4. **Subtitle** (Below title, 14px gap)
   - Alignment: Center
   - Font: 15px, Weight 400, Line height 1.6
   - Color: Text secondary
   - Max 2 lines

5. **Quote Card** (Below subtitle, 36px gap)
   - Width: Full width minus 32px horizontal padding
   - Background: Surface background
   - Border radius: 20px
   - Padding: 24px vertical, 20px horizontal
   - Contains:
     - Quote icon (28px, Primary with 120 alpha)
     - Quote text (15px, Weight 500, Italic, Line height 1.6)
     - Attribution (12px, Weight 700, Primary color, Letter spacing 0.5)

6. **Page Indicators** (28px from bottom of quote)
   - Alignment: Center horizontal
   - Active dot: 28px width, 8px height, Primary color
   - Inactive dots: 8x8px, Border color
   - Spacing: 4px between dots
   - Animation: 300ms duration

7. **CTA Button** (Bottom, 36px from indicators)
   - Width: Full width minus 28px horizontal padding
   - Height: 54px
   - Text: "Next" or "Get Started" (last page)
   - Style: Elevated button (primary)

**Pages:**
- Page 1: Pure Milk, Daily (water_drop icon)
- Page 2: 100% Authentic (verified icon)
- Page 3: Delivered Fresh (local_shipping icon)

**Behavior:**
- Auto-advance: No
- Swipe: Yes (horizontal)
- Skip: Navigates to login
- Last page button: "Get Started" → Login

---

### 4.2 LOGIN SCREEN

**Purpose:** Phone number authentication entry point

**Layout Structure:**
```
┌─────────────────────────────────────┐
│                                     │
│    [Full Screen Image Carousel]     │
│                                     │
│    (Dots at bottom of carousel)     │
│                                     │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐ │
│  │  [Logo Square]                │ │
│  │  YaduONE                      │ │
│  │  Soch nayi sanskaar wahi      │ │
│  │                               │ │
│  │  Phone Number                 │ │
│  │  [+91] [XXXXXXXXXX]           │ │
│  │                               │ │
│  │  [Error Message if any]       │ │
│  │                               │ │
│  │  [Send OTP Button →]          │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Visual Layers:**

**Layer 1: Background Carousel (Full Screen)**
- Position: Positioned.fill (covers entire screen)
- Component: Auto-sliding image carousel
- Images: 3 product images (ghee.jpg repeated)
- Auto-play: 4 seconds interval
- Transition: 700ms, easeInOut curve
- Fallback: Gradient (Primary light → #B8DFF5)
- Dot indicators:
  - Position: 24px from bottom
  - Style: ExpandingDotsEffect
  - Active: Primary color, expands 3x
  - Inactive: White
  - Size: 8x8px, 6px spacing

**Layer 2: Login Panel (Bottom, Overlapping)**
- Position: AnimatedPositioned at bottom
- Lifts with keyboard (responds to viewInsets.bottom)
- Background: Linear gradient
  - Colors: Soft mint (#E8F5E9) → Sky blue (#E3F2FD) → Pale green (#F1F8E9)
  - Direction: Top-left to bottom-right
- Border radius: 36px (top corners only)
- Shadow: Black with 20 alpha, 24px blur, -6px Y offset
- Padding: 26px horizontal, 28px top, 24px bottom
- Animation: 700ms fade + slide from bottom (0.25 offset)

**Panel Contents (Top to Bottom):**

1. **Logo Container** (Center aligned)
   - Size: 72x72px
   - Background: White
   - Border radius: 20px
   - Shadow: Primary with 22 alpha, 20px blur, 6px Y offset
   - Padding: 10px
   - Contains: App logo image (assets/images/image.png)
   - Fallback: Primary container with milk icon

2. **App Name** (12px below logo)
   - Text: "YaduONE"
   - Font: 26px, Weight 800, Letter spacing -0.5
   - Color: Text primary
   - Alignment: Center

3. **Tagline** (4px below name)
   - Text: "Soch nayi sanskaar wahi"
   - Font: 13.5px, Weight 500
   - Color: Text secondary
   - Alignment: Center

4. **Phone Label** (22px below tagline)
   - Text: "Phone Number"
   - Font: 13.5px, Weight 700
   - Color: Text primary
   - Alignment: Left

5. **Phone Input Row** (10px below label)
   - Layout: Horizontal row
   - Components:
     
     a. **Country Code Box**
        - Height: 54px
        - Background: White
        - Border radius: 14px
        - Padding: 14px horizontal
        - Contents: 🇮🇳 flag emoji + "+91" text (15px, Weight 700)
     
     b. **Spacing:** 10px
     
     c. **Phone Input Field** (Expanded)
        - Height: 54px
        - Background: White
        - Border radius: 14px
        - Max length: 10 digits
        - Keyboard: Phone type
        - Hint: "XXXXXXXXXX"
        - Font: 15px, Weight 700, Letter spacing 0.8
        - Focus border: Primary, 1.5px
        - No counter text

6. **Error Container** (14px below input, conditional)
   - Only shown if error exists
   - Background: Error color with 18 alpha
   - Border: Error color with 50 alpha, 1px
   - Border radius: 12px
   - Padding: 14px horizontal, 10px vertical
   - Contents:
     - Error icon (18px, Error color)
     - 8px spacing
     - Error text (12.5px, Weight 600, Error color)

7. **Send OTP Button** (20px below input/error)
   - Width: Full width
   - Height: 54px
   - Background: Primary color
   - Border radius: 16px
   - Text: "Send OTP" + arrow icon
   - Font: 15.5px, Weight 700, Letter spacing 0.4
   - Loading state: Shows circular progress (22x22px, white)

**Interaction Flow:**
1. User enters 10-digit phone number
2. Validation: Must be exactly 10 digits
3. On submit: Shows loading spinner
4. Success: Navigate to OTP screen
5. Error: Display error message in red container

---

### 4.3 OTP VERIFICATION SCREEN

**Purpose:** Verify phone number with 6-digit OTP

**Layout Structure:**
```
┌─────────────────────────────────────┐
│ [← Back]                            │
│                                     │
│    [Full Screen Image Carousel]     │
│                                     │
│    (Dots at bottom of carousel)     │
│                                     │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐ │
│  │  [Logo Square]                │ │
│  │  YaduONE                      │ │
│  │  Soch nayi sanskaar wahi      │ │
│  │                               │ │
│  │  Enter OTP    Resend OTP      │ │
│  │  [□][□][□][□][□][□]           │ │
│  │                               │ │
│  │  [Error Message if any]       │ │
│  │                               │ │
│  │  [Proceed Button]             │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Differences from Login Screen:**

1. **Back Button** (Top Left, Overlay)
   - Position: Fixed at top-left (safe area + 8px top, 16px left)
   - Size: 40x40px container
   - Background: White
   - Border radius: 12px
   - Shadow: Black with 20 alpha, 10px blur, 3px Y offset
   - Icon: arrow_back_ios_new, 16px

2. **Label Row** (Replaces single label)
   - Layout: Space between
   - Left: "Enter OTP" (13.5px, Weight 700, Text primary)
   - Right: "Resend OTP" (13px, Weight 600, Primary color) - clickable

3. **OTP Input** (Pinput component, 12px below label)
   - Length: 6 digits
   - Layout: Horizontal row with 6px spacing
   - Each box:
     - Size: 46px width, 54px height
     - Background: White
     - Border radius: 12px
     - Font: 20px, Weight 700, Text primary
     - Focus state: Primary border, 1.5px
   - Auto-focus on first box
   - Auto-advance on digit entry

4. **Proceed Button** (22px below OTP)
   - Text: "Proceed"
   - Same styling as Send OTP button

**Interaction Flow:**
1. User enters 6-digit OTP
2. Auto-submits when 6 digits entered (optional)
3. Manual submit via Proceed button
4. Loading state during verification
5. Success: Navigate to profile check
6. Error: Show error message

---

### 4.4 COMPLETE PROFILE SCREEN

**Purpose:** Collect user details and delivery address

**Layout Structure:**
```
┌─────────────────────────────────────┐
│ [← Back]  Complete Profile          │
├─────────────────────────────────────┤
│                                     │
│         [Person Icon Circle]        │
│     Set up your delivery profile    │
│                                     │
│  Full Name                          │
│  [Input Field]                      │
│                                     │
│  Delivery Area                      │
│  [Dropdown]                         │
│                                     │
│  Address Line 1                     │
│  [Input Field]                      │
│                                     │
│  Address Line 2 (Optional)          │
│  [Input Field]                      │
│                                     │
│  Landmark (Optional)                │
│  [Input Field]                      │
│                                     │
│  Pincode                            │
│  [Input Field]                      │
│                                     │
│  [Error Message if any]             │
│                                     │
│  [Save Profile Button]              │
│                                     │
└─────────────────────────────────────┘
```

**Element Details:**

1. **AppBar**
   - Background: White
   - Leading: Back button (Surface bg container, 10px radius, 8px padding)
   - Title: "Complete Profile" (20px, Weight 700)
   - Back action: Shows confirmation dialog before logout

2. **Header Icon** (Center, 32px from top)
   - Size: 72x72px
   - Background: Primary light
   - Border radius: 20px
   - Icon: person_outline_rounded, 36px, Primary color

3. **Subtitle** (16px below icon)
   - Text: "Set up your delivery profile"
   - Font: 15px, Text secondary
   - Alignment: Center

4. **Form Fields** (32px below subtitle)
   - Horizontal padding: 28px
   - Vertical spacing between fields: 18px (14px for optional)
   
   **Field Structure:**
   - Label: 14px, Weight 600, Text primary (8px above input)
   - Input: Standard text field with prefix icon
   - Icons: 20px, Hint color
   - Icon types:
     - Name: person_rounded
     - Area: location_on_outlined (dropdown)
     - Address: home_outlined, apartment_outlined
     - Landmark: place_outlined
     - Pincode: pin_drop_outlined

5. **Area Dropdown**
   - Loads areas from API
   - Shows loading spinner while fetching
   - Dropdown items: Area names
   - Hint: "Choose your area"

6. **Error Container** (14px below last field, conditional)
   - Same styling as login error

7. **Save Button** (28px below fields/error)
   - Text: "Save Profile"
   - Full width elevated button
   - Loading state: Circular progress (24x24px, white)

**Validation:**
- Required: Name, Area, Address Line 1, Pincode
- Optional: Address Line 2, Landmark
- Shows snackbar if required fields empty

**Back Button Behavior:**
- Shows dialog: "Go back to login?"
- Options: "Stay" or "Sign Out"
- Sign out logs user out completely

---

### 4.5 HOME SCREEN (Dashboard Tab)

**Purpose:** Main dashboard showing subscription status, tomorrow's delivery, and quick actions

**Layout Structure:**
```
┌─────────────────────────────────────┐
│  Good Morning,                      │
│  [Name]              [🔔] [📺]      │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ⚠️ Due Amount               │   │
│  │ Rs.XXX.XX              →    │   │
│  └─────────────────────────────┘   │
│                                     │
│  MY SUBSCRIPTION                    │
│  ┌─────────────────────────────┐   │
│  │ [Icon] COW Milk    [ACTIVE] │   │
│  │ 1L daily @ Rs.XX/L          │   │
│  │ [Manage Subscription]       │   │
│  └─────────────────────────────┘   │
│                                     │
│  TOMORROW'S DELIVERY                │
│  ┌─────────────────────────────┐   │
│  │ [Icon] 24 Apr 2026          │   │
│  │ COW - 1L                    │   │
│  │ + 2 extra items             │   │
│  │ ┌─────────────────────────┐ │   │
│  │ │ Total    Rs.XXX.XX      │ │   │
│  │ └─────────────────────────┘ │   │
│  └─────────────────────────────┘   │
│                                     │
│  SHOP                               │
│  ┌─────────────────────────────┐   │
│  │ [Icon] Browse Products      │   │
│  │ Paneer, curd, ghee & more → │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

**Element Details:**

1. **Header Section** (20px from top)
   - Padding: 20px horizontal
   - Layout: Row with space between
   
   **Left: Greeting**
   - "Good Morning/Afternoon/Evening," (14px, Text secondary)
   - First name (26px, Weight 800, Letter spacing -0.3, Text primary)
   - Vertical spacing: 2px
   
   **Right: Action Icons**
   - Two icons side by side, 10px spacing
   - Each icon:
     - Size: 44x44px
     - Background: White
     - Border radius: 14px
     - Shadow: Primary with 10 alpha, 12px blur, 2px Y offset
     - Icon: 22px, Text primary
   - Icons: notifications_outlined, live_tv_rounded

2. **Due Amount Card** (28px below header, conditional)
   - Only shown if due amount > 0
   - Background: Error color with 12 alpha
   - Border: Error color with 50 alpha, 1px
   - Border radius: 16px
   - Padding: 16px horizontal, 14px vertical
   - Tappable (navigates to Due screen)
   
   **Contents:**
   - Left: Icon container (40x40px, Error with 18 alpha bg, 11px radius)
     - Icon: account_balance_wallet_outlined, 20px, Error color
   - Middle: Text column (12px left spacing)
     - "Due Amount" (13px, Text secondary)
     - "Rs.XXX.XX" (17px, Weight 800, Error color)
   - Right: Arrow icon (14px, Error color)

3. **Section Pattern** (Repeated for each section)
   - Section label: 20px below previous section
   - Card: 12px below label
   - Next section: 24px below card
   
   **Section Label Component:**
   - Text: UPPERCASE
   - Font: 12px, Weight 700, Letter spacing 1.0
   - Color: Text hint

4. **Subscription Card**
   
   **No Subscription State:**
   - Icon circle: 56x56px, Primary light bg, 16px radius
   - Icon: water_drop_outlined, 28px, Primary
   - Text: "No active subscription" (15px, Text secondary)
   - Button: "Start Subscription" (elevated, primary)
   - Vertical spacing: 16px between elements
   
   **Active Subscription State:**
   - Row layout:
     - Icon container: 44x44px, Status color with 20 alpha, 12px radius
     - Icon: water_drop_rounded, 22px, Status color (Success/Warning)
     - Text column (14px left spacing):
       - Milk type: "COW MILK" (17px, Weight 700, Text primary)
       - Details: "1L daily @ Rs.XX/L" (13px, Text secondary)
     - Status badge: "ACTIVE"/"PAUSED" (11px, Weight 700, Letter spacing 0.5)
   - Button: "Manage Subscription" (outlined, 44px height, 16px top spacing)

5. **Tomorrow's Delivery Card**
   
   **Loading State:**
   - Shows centered circular progress (24x24px, Primary)
   
   **Loaded State:**
   - Row layout:
     - Icon container: 44x44px, Primary light bg, 12px radius
     - Icon: local_shipping_outlined, 22px, Primary
     - Text column (14px left spacing):
       - Date: "24 Apr 2026" (15px, Weight 600, Text primary)
       - Milk info: "COW - 1L" (13px, Text secondary)
       - OR "Delivery skipped" (13px, Error color)
   
   **If Skipped:**
   - Shows "SKIPPED" badge (12px top spacing)
   - Background: Error with 10 alpha
   - Text: "SKIPPED" (13px, Weight 700, Letter spacing 1, Error color)
   - Padding: 10px vertical
   - Border radius: 10px
   
   **If Not Skipped:**
   - Extra items text: "+ 2 extra items" (8px top, 13px, Text secondary)
   - Total container (14px top spacing):
     - Background: Primary light
     - Border radius: 12px
     - Padding: 14px vertical, 16px horizontal
     - Row: "Total" (15px, Weight 600, Primary) | "Rs.XXX.XX" (18px, Weight 800, Primary)

6. **Shop Banner** (Gradient card)
   - Background: Linear gradient (Primary → Primary dark)
   - Border radius: 16px
   - Padding: 16px
   - Tappable (navigates to Products screen)
   
   **Contents:**
   - Icon container: 48x48px, White with 30 alpha, 14px radius
   - Icon: storefront_rounded, 26px, White
   - Text column (14px left spacing):
     - "Browse Products" (16px, Weight 700, White)
     - "Paneer, curd, ghee & more" (13px, White 70% opacity)
   - Arrow icon: 16px, White 70% opacity

**Pull-to-Refresh:**
- Enabled on entire list
- Refreshes: Subscription, Tomorrow status, Due amount
- Color: Primary

---

### 4.6 SUBSCRIPTION SCREEN

**Purpose:** Create or manage milk subscription

**Layout Structure (Create Mode):**
```
┌─────────────────────────────────────┐
│ [← Back]  Subscription              │
├─────────────────────────────────────┤
│         [Milk Icon Circle]          │
│   Start Daily Milk Subscription     │
│   Choose your preferences below     │
│                                     │
│  SELECT MILK TYPE                   │
│  ┌─────────────────────────────┐   │
│  │ [Icon] Cow Milk         ✓   │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ [Icon] Buffalo Milk         │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ [Icon] Mixed Milk           │   │
│  └─────────────────────────────┘   │
│                                     │
│  DAILY QUANTITY                     │
│  ┌─────────────────────────────┐   │
│  │  [-]    1.0L    [+]         │   │
│  └─────────────────────────────┘   │
│                                     │
│  DELIVERY SLOT                      │
│  ┌─────────────────────────────┐   │
│  │ [☀️] Morning (5-7 AM)   ✓   │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ [🌙] Evening (5-7 PM)       │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ [🔄] Both Times             │   │
│  └─────────────────────────────┘   │
│                                     │
│  START DATE                         │
│  ┌─────────────────────────────┐   │
│  │ [📅] 25 Apr 2026        >   │   │
│  └─────────────────────────────┘   │
│                                     │
│  [Start Subscription Button]        │
│                                     │
└─────────────────────────────────────┘
```

**Element Details:**

1. **AppBar**
   - Background: Scaffold background
   - Leading: Back button (white container)
   - Title: "Subscription"

2. **Header** (Center aligned)
   - Icon circle: 72x72px, Primary light, 20px radius
   - Icon: water_drop_rounded, 36px, Primary
   - Title: "Start Daily Milk Subscription" (20px, Weight 800, 16px top)
   - Subtitle: "Choose your preferences below" (14px, Text secondary, 6px top)

3. **Milk Type Selection** (32px below header)
   - Each option: 10px bottom spacing
   - Card structure:
     - Background: Selected = Primary light, Unselected = White
     - Border: Selected = Primary 1.5px, Unselected = Border 1px
     - Border radius: 14px
     - Padding: 16px
     
   **Contents:**
   - Icon container: 40x40px, 10px radius
     - Selected: Primary with 20 alpha
     - Unselected: Surface background
   - Icon: water_drop_rounded, 20px
   - Text: Milk type label (16px, Weight 700 if selected, 500 if not)
   - Check icon: 22px, Primary (only if selected)

4. **Quantity Stepper** (24px below milk type)
   - Container: PremiumCard (centered content)
   - Layout: Horizontal row
   
   **Components:**
   - Minus button: 48x48px, 14px radius
     - Background: Primary (enabled) or Border (disabled)
     - Icon: remove_rounded, 24px, White/Hint
   - Quantity display: 90px width, centered
     - Text: "1.0L" (28px, Weight 800, Text primary)
   - Plus button: Same as minus
   
   **Range:** 0.5L to 10L in 0.5L increments

5. **Delivery Slot Selection** (24px below quantity)
   - Same card structure as milk type
   - Each option: 10px bottom spacing
   
   **Contents:**
   - Icon container: 40x40px, 10px radius
   - Icons: wb_sunny_rounded (morning), nights_stay_rounded (evening), sync_rounded (both)
   - Text column:
     - Label: "Morning"/"Evening"/"Both Times" (15px, Weight 700/500)
     - Subtitle: "5-7 AM"/"5-7 PM"/"Morning & Evening" (12px, Text secondary)
   - Check icon: 22px, Primary (only if selected)

6. **Start Date Picker** (24px below slot)
   - Card: PremiumCard, tappable
   - Opens native date picker
   
   **Contents:**
   - Icon container: 44x44px, Primary light, 12px radius
   - Icon: calendar_today_rounded, 20px, Primary
   - Date text: "25 Apr 2026" (16px, Weight 600, Text primary)
   - Chevron icon: 16px, Hint color

7. **Error Container** (14px below date, conditional)
   - Same styling as previous screens

8. **Submit Button** (32px below date/error)
   - Text: "Start Subscription"
   - Full width elevated button
   - Loading state: Circular progress

**Layout Structure (Manage Mode):**
```
┌─────────────────────────────────────┐
│ [← Back]  Subscription              │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │ [Icon] COW MILK    [ACTIVE] │   │
│  │                             │   │
│  │ Daily: 1L                   │   │
│  │ Slot: Morning (5-7 AM)      │   │
│  │ Price: Rs.XX/litre          │   │
│  │ Started: 2026-04-01         │   │
│  └─────────────────────────────┘   │
│                                     │
│  [⏸️ Pause Subscription]            │
│  [❌ Cancel Subscription]           │
│                                     │
└─────────────────────────────────────┘
```

**Manage Mode Details:**

1. **Subscription Info Card**
   - Header row:
     - Icon: 52x52px, Status color with 20 alpha, 14px radius
     - Text: "COW MILK" (20px, Weight 800)
     - Status badge: "ACTIVE"/"PAUSED"
   
   **Info Rows** (20px below header, 10px spacing):
   - Icon: 18px, Hint color
   - Label: 14px, Text secondary
   - Value: 14px, Weight 600, Text primary
   - Rows: Daily quantity, Slot, Price, Start date

2. **Action Buttons** (28px below card, 12px spacing)
   - Height: 52px
   - Style: Outlined button with icon
   - Colors:
     - Pause: Warning
     - Resume: Success
     - Cancel: Error
   
   **Cancel Confirmation:**
   - Shows dialog: "Cancel Subscription?"
   - Warning: "This cannot be undone..."
   - Options: "No" or "Yes, Cancel"

---

### 4.7 PRODUCTS SCREEN

**Purpose:** Browse and add dairy products to cart

**Layout Structure:**
```
┌─────────────────────────────────────┐
│ [← Back]  Shop                      │
├─────────────────────────────────────┤
│ [All][Curd][Paneer][Ghee]...        │
├─────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐        │
│  │  Image   │  │  Image   │        │
│  │  ••••    │  │  ••••    │        │
│  │          │  │          │        │
│  │ Product  │  │ Product  │        │
│  │ Name     │  │ Name     │        │
│  │ 500g     │  │ 1kg      │        │
│  │ ₹XX  [+] │  │ ₹XX  [+] │        │
│  └──────────┘  └──────────┘        │
│  ┌──────────┐  ┌──────────┐        │
│  │  Image   │  │  Image   │        │
│  │  ••••    │  │  ••••    │        │
│  │          │  │          │        │
│  │ Product  │  │ Product  │        │
│  │ Name     │  │ Name     │        │
│  │ 250ml    │  │ 1L       │        │
│  │ ₹XX  [+] │  │ ₹XX  [+] │        │
│  └──────────┘  └──────────┘        │
│                                     │
└─────────────────────────────────────┘
```

**Element Details:**

1. **AppBar**
   - Background: White
   - Title: "Shop"
   - Leading: Back button

2. **Category Filter Bar** (Horizontal scroll)
   - Height: 52px
   - Padding: 16px horizontal, 10px vertical
   - Spacing: 8px between chips
   
   **Category Chip:**
   - Padding: 14px horizontal, 6px vertical
   - Border radius: 20px
   - Selected:
     - Background: Primary
     - Border: Primary
     - Text: White, 13px, Weight 600
   - Unselected:
     - Background: White
     - Border: Border color
     - Text: Text secondary, 13px, Weight 600
   - Animation: 200ms duration
   
   **Categories:** All, Curd, Paneer, Butter Milk, Ghee, Butter, Lassi, Cream, Cheese

3. **Product Grid**
   - Padding: 16px horizontal, 8px top, 24px bottom
   - Columns: 2
   - Cross spacing: 12px
   - Main spacing: 12px
   - Aspect ratio: 0.72 (portrait cards)
   
   **Product Card:**
   - Background: White
   - Border radius: 16px
   - Shadow: Primary with 10 alpha, 16px blur, 4px Y offset
   - Tappable (opens detail screen)
   
   **Card Structure (Top to Bottom):**
   
   a. **Image Area** (140px height)
      - Border radius: 16px (top corners only)
      - Carousel if multiple images
      - Auto-play: 3 seconds
      - Dot indicators: 5px dots, worm effect, 6px from bottom
      - Fallback: Primary light bg with inventory icon
   
   b. **Info Section** (Padding: 10px horizontal, 8px vertical)
      - Product name: 13px, Weight 700, Text primary, Max 2 lines
      - Unit: 11px, Hint color, 2px top spacing
      - Price row (bottom aligned):
        - Price: "₹XX" (15px, Weight 800, Primary)
        - Add button: 30x30px, 8px radius, Primary bg
          - Icon: add_rounded, 18px, White
          - Loading: Circular progress (6px padding)

**States:**
- Loading: Shows centered circular progress
- Empty: Shows empty state with icon and message
- Error: Same as empty with error message

**Pull-to-Refresh:** Enabled, reloads products

---

### 4.8 PRODUCT DETAIL SCREEN

**Purpose:** View product details and add to cart with quantity

**Layout Structure:**
```
┌─────────────────────────────────────┐
│ [← Back]                            │
│                                     │
│    [Full Width Image Carousel]      │
│         (320px height)              │
│         Dots at bottom              │
│                                     │
├─────────────────────────────────────┤
│  [CATEGORY CHIP]                    │
│                                     │
│  Product Name                       │
│  500g                               │
│                                     │
│  ₹XX              [-] 1 [+]         │
│                                     │
│  ABOUT                              │
│  Product description text goes      │
│  here with details about the        │
│  product quality and features.      │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Total for 1 item  ₹XX.XX    │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
│ [🛒 Add to Tomorrow's Cart]         │
└─────────────────────────────────────┘
```

**Element Details:**

1. **Collapsing AppBar (SliverAppBar)**
   - Expanded height: 320px
   - Pinned: Yes
   - Background: White
   - Leading: Back button (white circle with 220 alpha, centered icon)
   
   **Flexible Space:**
   - Image carousel (same as product card)
   - Fallback: Primary light with large inventory icon (64px)
   - Dot indicators: 7px dots, worm effect, 16px from bottom

2. **Content Section** (Padding: 20px horizontal, 20px top, 100px bottom)

   a. **Category Chip**
      - Background: Primary light
      - Border radius: 8px
      - Padding: 10px horizontal, 4px vertical
      - Text: Category name (11px, Weight 700, Primary, Letter spacing 0.8, UPPERCASE)
   
   b. **Product Name** (10px below chip)
      - Font: 24px, Weight 800, Letter spacing -0.3
      - Color: Text primary
   
   c. **Unit** (4px below name)
      - Font: 14px, Text secondary
   
   d. **Price & Quantity Row** (20px below unit)
      - Layout: Space between
      
      **Price:**
      - Text: "₹XX" (28px, Weight 900, Primary)
      
      **Quantity Stepper:**
      - Background: Surface background
      - Border radius: 12px
      - Components:
        - Minus button: 36x36px, 10px radius
          - Enabled: Primary bg, White icon
          - Disabled: Transparent, Hint icon
        - Quantity: 36px width, centered, "1" (16px, Weight 700)
        - Plus button: Same as minus
      - Range: 1 to 20
   
   e. **Description Section** (24px below price row, conditional)
      - Label: "ABOUT" (12px, Weight 700, Hint color, Letter spacing 1.0)
      - Text: Description (15px, Text secondary, Line height 1.6, 8px top)
   
   f. **Total Container** (24px below description)
      - Background: Primary light
      - Border radius: 12px
      - Padding: 16px horizontal, 12px vertical
      - Row layout:
        - "Total for X item(s)" (14px, Primary)
        - "₹XX.XX" (18px, Weight 800, Primary)

3. **Bottom CTA Bar**
   - Background: White
   - Border top: Border color, 1px
   - Padding: 20px horizontal, 12px top, 28px bottom
   - Button: Full width elevated, 52px height
   - Icon: add_shopping_cart_rounded
   - Text: "Add to Tomorrow's Cart"
   - Loading: Shows progress with "Adding..." text

**Interaction:**
- Tap product card → Opens this screen
- Adjust quantity → Updates total
- Add to cart → Shows success snackbar → Closes screen

---

### 4.9 CART SCREEN (Tomorrow's Delivery Tab)

**Purpose:** Manage tomorrow's milk delivery and extra products

**Layout Structure:**
```
┌─────────────────────────────────────┐
│  Tomorrow's Cart                    │
│  Delivery on 24 Apr 2026            │
│                                     │
│  MILK                               │
│  ┌─────────────────────────────┐   │
│  │ [Icon] COW Milk             │   │
│  │                             │   │
│  │      [-]  1.0L  [+]         │   │
│  │                             │   │
│  │  Reset to default (1L)      │   │
│  │                             │   │
│  │  [Skip Tomorrow]            │   │
│  └─────────────────────────────┘   │
│                                     │
│  EXTRA PRODUCTS                     │
│  ┌─────────────────────────────┐   │
│  │ [Icon] Paneer               │   │
│  │ 2x 250g @ Rs.XX             │   │
│  │                    Rs.XX [×]│   │
│  └─────────────────────────────┘   │
│                                     │
│  [+ Add Extra Products]             │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Total          Rs.XXX.XX    │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

**Element Details:**

1. **Header** (20px from top)
   - Title: "Tomorrow's Cart" (26px, Weight 800, Letter spacing -0.3)
   - Subtitle: "Delivery on [date]" (14px, Text secondary, 4px top)

2. **Milk Section** (24px below header, conditional)
   - Only shown if active subscription exists
   - Section label: "MILK"
   - Card: PremiumCard (12px below label)
   
   **Skipped State:**
   - Icon: 44x44px, Error with 15 alpha, 12px radius
   - Icon: block_rounded, 22px, Error
   - Text: "Delivery Skipped" (17px, Weight 700, Error)
   - Button: "Undo Skip" (outlined, Success color, 16px top)
   
   **Active State:**
   - Header row:
     - Icon: 44x44px, Primary light, 12px radius
     - Icon: water_drop_rounded, 22px, Primary
     - Text: "COW MILK" (17px, Weight 700, Text primary)
   
   - Quantity stepper (20px below header, centered):
     - Container: Surface background, 14px radius
     - Padding: 8px horizontal, 6px vertical
     - Buttons: 44x44px, 12px radius
       - Enabled: Primary bg, White icon
       - Disabled: Border bg, Hint icon
     - Display: 80px width, "1.0L" (24px, Weight 800)
     - Range: 0.5L to 10L
   
   - Reset button (12px below stepper, conditional):
     - Only shown if quantity differs from subscription default
     - Text: "Reset to default (XL)" (TextButton, Primary)
   
   - Skip button (16px below stepper/reset):
     - Style: Outlined, Error color
     - Text: "Skip Tomorrow"

3. **Extra Products Section** (24px below milk)
   - Section label: "EXTRA PRODUCTS"
   - Card: PremiumCard (12px below label)
   
   **Empty State:**
   - Icon: shopping_bag_outlined, 36px, Hint color
   - Text: "No extra products added" (14px, Text secondary)
   - Centered, vertical layout
   
   **With Items:**
   - Padding: 8px vertical, 4px horizontal
   - Each item row (4px vertical, 12px horizontal padding):
     - Icon container: 40x40px, Surface bg, 10px radius
     - Icon: inventory_2_outlined, 18px, Primary
     - Text column (12px left spacing):
       - Name: 14px, Weight 600
       - Details: "Xx unit @ Rs.XX" (12px, Text secondary)
     - Total: "Rs.XX.XX" (14px, Weight 700, Text primary)
     - Remove button: close_rounded icon, 18px, Error

4. **Add Products Button** (16px below extras)
   - Style: Outlined button with icon
   - Icon: add_rounded, 20px
   - Text: "Add Extra Products"
   - Opens bottom sheet with product list

5. **Total Container** (24px below button)
   - Background: Linear gradient (Primary → Primary dark)
   - Border radius: 16px
   - Padding: 20px
   - Row: "Total" (17px, Weight 600, White) | "Rs.XXX.XX" (22px, Weight 800, White)

**Pull-to-Refresh:** Enabled, reloads tomorrow status

**Add Products Bottom Sheet:**
- Background: White
- Border radius: 24px (top corners)
- Draggable: Yes (40px width, 4px height handle)
- Initial size: 60% of screen
- Max size: 90%
- Min size: 40%

**Sheet Contents:**
- Handle bar (centered, 4px height, Border color)
- Title: "Add Products" (20px, Weight 700, 20px top)
- Product list (scrollable):
  - Each item: ListTile with 8px vertical, 4px horizontal padding
  - Leading: 44x44px icon container (Surface bg, 12px radius)
  - Title: Product name (Weight 600)
  - Subtitle: "unit - Rs.XX" (13px, Text secondary)
  - Trailing: Add button (36x36px, 10px radius, Primary bg, add icon)
- Tap add → Adds to cart → Closes sheet

---

### 4.10 REPORTS SCREEN

**Purpose:** Display user's delivery analytics and statistics

**Layout Structure:**
```
┌─────────────────────────────────────┐
│  Reports & Insights                 │
│  Your delivery analytics at a glance│
│                                     │
│  ┌──────────┐  ┌──────────┐        │
│  │ [Icon]   │  │ [Icon]   │        │
│  │ XXL      │  │ XXL      │        │
│  │ Delivered│  │ Pending  │        │
│  └──────────┘  └──────────┘        │
│  ┌──────────┐  ┌──────────┐        │
│  │ [Icon]   │  │ [Icon]   │        │
│  │ Rs.XXX   │  │ X days   │        │
│  │ Total    │  │ Skipped  │        │
│  │ Spent    │  │          │        │
│  └──────────┘  └──────────┘        │
│  ┌─────────────────────────────┐   │
│  │ [Icon]                      │   │
│  │ XX                          │   │
│  │ Extra Items Ordered         │   │
│  └─────────────────────────────┘   │
│                                     │
│  MONTHLY SUMMARY                    │
│  ┌─────────────────────────────┐   │
│  │ [📅] April 2026             │   │
│  │ XXL milk, XX extras         │   │
│  │                    Rs.XXX   │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ [📅] March 2026             │   │
│  │ XXL milk, XX extras         │   │
│  │                    Rs.XXX   │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

**Element Details:**

1. **Header** (20px from top)
   - Title: "Reports & Insights" (26px, Weight 800, Letter spacing -0.3)
   - Subtitle: "Your delivery analytics at a glance" (14px, Text secondary, 4px top)

2. **Stats Grid** (24px below header)
   - Layout: 2x2 grid + 1 full width
   - Spacing: 12px between cards
   
   **Stat Card (PremiumCard):**
   - Icon container: 40x40px, Color with 20 alpha, 12px radius
   - Icon: 20px, Status color
   - Value: 22px, Weight 800, Status color (14px top)
   - Label: 12px, Weight 500, Text secondary (2px top)
   
   **Stats:**
   - Delivered: local_drink_rounded, Success color
   - Pending: pending_rounded, Warning color
   - Total Spent: currency_rupee_rounded, Primary color
   - Skipped: event_busy_rounded, Error color
   - Extra Items: shopping_bag_rounded, Purple (#8B5CF6) - Full width

3. **Monthly Summary Section** (28px below stats)
   - Section label: "MONTHLY SUMMARY"
   - Cards: 10px spacing (12px below label)
   
   **Month Card (PremiumCard):**
   - Padding: 16px horizontal, 14px vertical
   - Row layout:
     - Icon container: 44x44px, Primary light, 12px radius
     - Icon: calendar_month_rounded, 20px, Primary
     - Text column (14px left spacing):
       - Month: "April 2026" (15px, Weight 700, Text primary)
       - Details: "XXL milk, XX extras" (12px, Text secondary, 2px top)
     - Amount: "Rs.XXX" (16px, Weight 800, Primary)

**States:**
- Loading: Centered circular progress
- Error: Icon + error message
- Empty: No monthly summary cards

**Pull-to-Refresh:** Enabled, reloads report data

---

### 4.11 PROFILE SCREEN

**Purpose:** Display user information and order history

**Layout Structure:**
```
┌─────────────────────────────────────┐
│  Profile                    [🚪]    │
│                                     │
│  ┌─────────────────────────────┐   │
│  │         [Avatar]            │   │
│  │         User Name           │   │
│  │         +91XXXXXXXXXX       │   │
│  │         [Area Badge]        │   │
│  │                             │   │
│  │  ────────────────────       │   │
│  │                             │   │
│  │  [📍] Address Line 1        │   │
│  │       Address Line 2        │   │
│  │       Pincode: XXXXXX       │   │
│  └─────────────────────────────┘   │
│                                     │
│  ORDER HISTORY                      │
│  ┌─────────────────────────────┐   │
│  │ [✓] 23 Apr 2026             │   │
│  │ cow 1L + 2 extras           │   │
│  │                Rs.XX.XX     │   │
│  │                DELIVERED    │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ [⏰] 22 Apr 2026             │   │
│  │ cow 1L                      │   │
│  │                Rs.XX.XX     │   │
│  │                PENDING      │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

**Element Details:**

1. **Header** (20px from top)
   - Layout: Row with space between
   - Title: "Profile" (26px, Weight 800, Letter spacing -0.3)
   - Logout button: 44x44px, White bg, 14px radius
     - Shadow: Primary with 10 alpha, 12px blur, 2px Y offset
     - Icon: logout_rounded, 20px, Error color
     - Shows confirmation dialog on tap

2. **Profile Card** (24px below header)
   - PremiumCard, centered content
   
   **Contents:**
   a. **Avatar** (Top)
      - Size: 72x72px
      - Background: Linear gradient (Primary → Primary dark)
      - Border radius: 22px
      - Text: First letter of name (30px, Weight 800, White)
   
   b. **Name** (14px below avatar)
      - Font: 20px, Weight 700, Text primary
   
   c. **Phone** (4px below name)
      - Font: 14px, Text secondary
   
   d. **Area Badge** (12px below phone, conditional)
      - Background: Primary light
      - Border radius: 8px
      - Padding: 14px horizontal, 6px vertical
      - Text: Area name (13px, Weight 600, Primary)
   
   e. **Divider** (16px below badge)
      - Full width, 1px, Divider color
   
   f. **Address Section** (12px below divider, conditional)
      - Row layout:
        - Icon container: 36x36px, Surface bg, 10px radius
        - Icon: location_on_outlined, 18px, Primary
        - Text column (12px left spacing):
          - Line 1: 14px, Text primary
          - Line 2: 13px, Text secondary (if exists)
          - Pincode: "Pincode: XXXXXX" (13px, Text secondary)

3. **Order History Section** (28px below profile card)
   - Section label: "ORDER HISTORY"
   - Cards: 10px spacing (12px below label)
   
   **Loading State:**
   - Centered circular progress (32px padding)
   
   **Empty State:**
   - Icon: receipt_long_outlined, 40px, Hint color
   - Text: "No orders yet" (14px, Text secondary)
   - Centered in PremiumCard
   
   **Order Card (PremiumCard):**
   - Padding: 16px horizontal, 14px vertical
   - Row layout:
     - Icon container: 44x44px, Status color with 15 alpha, 12px radius
     - Icon: check_circle_outline (delivered) or schedule (pending), 22px
     - Text column (14px left spacing):
       - Date: 14px, Weight 600, Text primary
       - Details: "milk_type XL + X extras" or "No milk" (12px, Text secondary, 2px top)
     - Amount column (right aligned):
       - Amount: "Rs.XX.XX" (14px, Weight 700, Text primary)
       - Status: "DELIVERED"/"PENDING" (10px, Weight 700, Letter spacing 0.5, Status color, 2px top)

**Logout Dialog:**
- Title: "Logout?"
- Shape: 20px border radius
- Actions: "Cancel" (TextButton) | "Logout" (TextButton, Error color)

---

### 4.12 DUE SCREEN

**Purpose:** View due amount and manage payment tickets

**Layout Structure:**
```
┌─────────────────────────────────────┐
│ [← Back]  Due Amount                │
│ [Balance] [My Tickets]              │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │ [💰] Outstanding Due        │   │
│  │                             │   │
│  │ Rs.XXX.XX                   │   │
│  │                             │   │
│  │ Please pay to your delivery │   │
│  │ agent                       │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Total Billed    Rs.XXX.XX   │   │
│  │ ─────────────────────────   │   │
│  │ Total Paid      Rs.XXX.XX   │   │
│  │ ─────────────────────────   │   │
│  │ Balance Due     Rs.XXX.XX   │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ [👤] Dispute a charge?      │   │
│  │ Raise a ticket and we'll    │   │
│  │ look into it        [Raise] │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

**Element Details:**

1. **AppBar**
   - Background: Scaffold background
   - Leading: Back button (white container)
   - Title: "Due Amount"
   - Bottom: TabBar
     - Tabs: "Balance" | "My Tickets"
     - Label color: Primary (selected), Text secondary (unselected)
     - Indicator: Primary, label size

**Balance Tab:**

2. **Due Amount Card** (8px from top)
   - Width: Full width minus 20px horizontal padding
   - Background: Gradient
     - If due > 0: Red gradient (#FF6B6B → #FF3B30)
     - If due = 0: Primary gradient (Primary → Primary dark)
   - Border radius: 24px
   - Padding: 24px horizontal, 28px vertical
   - Shadow: Status color with 50 alpha, 24px blur, 8px Y offset
   
   **Contents:**
   - Header row:
     - Icon container: 8px padding, White with 30 alpha, 10px radius
     - Icon: account_balance_wallet_outlined (due) or check_circle_outline (clear), 20px, White
     - Label: "Outstanding Due" or "All Clear" (14px, Weight 500, White 70%)
   - Amount: "Rs.XXX.XX" (40px, Weight 800, Letter spacing -1, White, 16px top)
   - Message: "Please pay to your delivery agent" (13px, White 70%, 6px top, conditional)

3. **Breakdown Card** (20px below due card)
   - PremiumCard
   - Three rows with dividers (20px height)
   
   **Row Structure:**
   - Label: 14px, Text secondary
   - Value: 14px/16px, Weight 600/800, Status color
   - Rows:
     - Total Billed: Text primary
     - Total Paid: Success color
     - Balance Due: Error/Success color, Weight 800

4. **Raise Ticket CTA** (24px below breakdown)
   - Background: Primary light
   - Border: Primary with 40 alpha, 1px
   - Border radius: 16px
   - Padding: 16px
   
   **Contents:**
   - Icon container: 42x42px, Primary with 20 alpha, 12px radius
   - Icon: support_agent_rounded, 22px, Primary
   - Text column (14px left spacing):
     - Title: "Dispute a charge?" (14px, Weight 700, Text primary)
     - Subtitle: "Raise a ticket and we'll look into it" (12px, Text secondary, 2px top)
   - Button: "Raise" (TextButton, Primary)

**My Tickets Tab:**

5. **Empty State**
   - Icon: inbox_outlined, 52px, Hint color (80px top)
   - Text: "No tickets raised" (15px, Text secondary, 12px top)
   - Hint: "Raise a ticket from the Balance tab" (13px, Hint color, 8px top)
   - Centered

6. **Ticket Card** (PremiumCard, 10px spacing)
   - Padding: 16px
   
   **Contents:**
   - Header row:
     - Subject: 14px, Weight 700, Text primary
     - Status badge: 10px, Weight 700, Letter spacing 0.5, UPPERCASE
       - Open: Error color/bg
       - In Review: Warning color/bg
       - Resolved: Success color/bg
   - Description: 13px, Text secondary, Line height 1.4 (6px top)
   - Admin notes (conditional, 10px top):
     - Container: Surface bg, 10px radius, 10px padding
     - Icon: admin_panel_settings_outlined, 14px, Primary
     - Text: 12px, Text primary, Line height 1.4 (6px left)

**Raise Ticket Bottom Sheet:**
- Background: White
- Border radius: 28px (top corners)
- Padding: 24px horizontal, 20px top, 32px bottom
- Responds to keyboard (viewInsets.bottom)

**Sheet Contents:**
- Handle: 36px width, 4px height, Border color (centered, 20px bottom)
- Title: "Raise a Ticket" (20px, Weight 800, Text primary)
- Subtitle: "Describe your due amount concern" (13px, Text secondary, 4px top)
- Subject field: 20px top
  - Label: "Subject"
  - Hint: "e.g. Incorrect charge on 15 Apr"
- Description field: 12px below subject
  - Label: "Description"
  - Hint: "Explain what seems wrong..."
  - Max lines: 4
- Error text: 10px below fields (conditional, 12.5px, Error color)
- Submit button: 20px below fields/error
  - Width: Full width, Height: 52px
  - Text: "Submit Ticket"
  - Loading: Circular progress (20x20px, white)

**Pull-to-Refresh:** Enabled on both tabs

---

### 4.13 NOTIFICATIONS SCREEN

**Purpose:** Display user notifications and alerts

**Layout Structure:**
```
┌─────────────────────────────────────┐
│ [← Back]  Notifications             │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │ [ℹ️] Notification Title  •  │   │
│  │ Notification body text goes │   │
│  │ here with details...        │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ [⚠️] Alert Title            │   │
│  │ Alert body text goes here   │   │
│  │ with important info...      │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

**Element Details:**

1. **AppBar**
   - Background: Scaffold background
   - Leading: Back button (white container)
   - Title: "Notifications"

2. **Empty State**
   - Icon: notifications_off_outlined, 56px, Hint color
   - Text: "No notifications" (16px, Text secondary, 16px top)
   - Centered

3. **Notification Card** (PremiumCard, 10px spacing)
   - Padding: 16px horizontal, 14px vertical
   - Background: Unread = Primary light, Read = White
   - Row layout (cross-axis start)
   
   **Contents:**
   - Icon container: 40x40px, 10px radius
     - Alert: Error with 15 alpha bg, warning_amber_rounded icon
     - Info: Primary with 15 alpha bg, info_outline_rounded icon
   - Text column (14px left spacing):
     - Title: 14px, Weight 700 (unread) or 500 (read), Text primary
     - Body: 13px, Text secondary, Line height 1.4 (4px top)
   - Unread dot: 8px circle, Primary (4px top, conditional)

**States:**
- Loading: Centered circular progress
- Empty: Empty state with icon
- Loaded: List of notification cards

---

### 4.14 LIVESTREAM SCREEN

**Purpose:** View active livestream or show unavailable state

**Layout Structure:**
```
┌─────────────────────────────────────┐
│ [← Back]  Live Stream               │
├─────────────────────────────────────┤
│                                     │
│         [TV Icon Circle]            │
│                                     │
│         [LIVE Badge]                │
│                                     │
│         Livestream Title            │
│                                     │
│  [▶️ Watch on YouTube]              │
│                                     │
└─────────────────────────────────────┘
```

**Element Details:**

1. **AppBar**
   - Background: Scaffold background
   - Leading: Back button (white container)
   - Title: "Live Stream"

2. **No Stream State** (Centered, 40px padding)
   - Icon container: 80x80px, Surface bg, 24px radius
   - Icon: live_tv_rounded, 36px, Hint color
   - Title: "No live stream available" (18px, Weight 700, Text primary, 20px top)
   - Subtitle: "Check back later for live updates\nfrom your area" (14px, Text secondary, Line height 1.5, Center aligned, 8px top)

3. **Active Stream State** (24px padding)
   
   **Live Card (PremiumCard):**
   - Icon container: 64x64px, Error with 15 alpha, 18px radius
   - Icon: live_tv_rounded, 32px, Error
   - LIVE badge (16px below icon):
     - Background: Error
     - Border radius: 8px
     - Padding: 16px horizontal, 6px vertical
     - Text: "LIVE" (13px, Weight 800, Letter spacing 1.5, White)
   - Title: Livestream title (20px, Weight 700, Text primary, 20px top, Center)
   
   **Watch Button** (28px below card):
   - Style: Elevated button with icon
   - Background: Error (YouTube red)
   - Icon: play_arrow_rounded
   - Text: "Watch on YouTube"
   - Action: Opens YouTube URL in external app

**States:**
- Loading: Centered circular progress
- No stream: Empty state
- Active stream: Live card + button

---

## 5. REUSABLE COMPONENTS

### 5.1 PremiumCard

**Purpose:** Consistent card styling across the app

**Properties:**
- Background: Card background (white) or custom
- Border radius: 16px
- Border: Border color, 0.5px
- Shadow: Primary with 12 alpha, 20px blur, 4px Y offset
- Padding: 20px (default) or custom
- Margin: Zero (controlled by parent)

**Usage:** Subscription cards, delivery cards, profile card, stat cards

### 5.2 SectionLabel

**Purpose:** Consistent section headers

**Properties:**
- Text: UPPERCASE
- Font: 12px, Weight 700, Letter spacing 1.0
- Color: Text hint

**Usage:** All section headers (MY SUBSCRIPTION, TOMORROW'S DELIVERY, etc.)

### 5.3 CurvedNavBar

**Purpose:** Custom bottom navigation with center FAB

**Properties:**
- Height: 56px + safe area
- Background: White with custom curved path
- Center cutout: 38px radius
- FAB: Primary color, home icon
- Nav items: 4 items (Reports, Cart, Live, Profile)

**States:**
- Selected: Primary color background circle + primary icon
- Unselected: Hint color icon

### 5.4 AuthImageCarousel

**Purpose:** Auto-sliding image carousel for auth screens

**Properties:**
- Height: Fills parent
- Images: 3 product images
- Auto-play: 4 seconds interval
- Transition: 700ms, easeInOut
- Indicators: Expanding dots effect
- Fallback: Gradient background

**Usage:** Login screen, OTP screen

### 5.5 Stepper Button

**Purpose:** Increment/decrement quantity controls

**Properties:**
- Size: 36-48px square
- Border radius: 10-14px
- Enabled: Primary background, white icon
- Disabled: Border/transparent background, hint icon
- Icon: add_rounded or remove_rounded

**Usage:** Subscription quantity, cart quantity, product detail quantity

---

## 6. UX FLOW DETAILS

### 6.1 Subscribing to Milk

**Steps:**
1. From Home → Tap "Start Subscription" button
2. Select milk type (Cow/Buffalo/Mixed) - Single selection, visual feedback
3. Adjust quantity using stepper (0.5L - 10L)
4. Select delivery slot (Morning/Evening/Both) - Single selection
5. Pick start date (tomorrow or later) - Date picker
6. Review selections
7. Tap "Start Subscription"
8. Loading state shown
9. Success → Navigate back to Home
10. Home shows active subscription

**Validation:**
- All fields required
- Start date must be future date
- Quantity must be >= 0.5L

**Error Handling:**
- API errors shown in red container
- User can retry without losing selections

### 6.2 Booking Dairy Products

**Steps:**
1. From Home → Tap "Browse Products" banner OR navigate to Cart tab → Tap "Add Extra Products"
2. Browse products by category (horizontal filter)
3. Tap product card → Opens detail screen
4. View product images (carousel), description, price
5. Adjust quantity using stepper (1-20)
6. Tap "Add to Tomorrow's Cart"
7. Loading state shown
8. Success → Snackbar confirmation → Screen closes
9. Cart tab shows added product

**Alternative Flow:**
1. From Products screen → Tap "+" button on product card
2. Adds 1 quantity directly
3. Snackbar confirmation
4. Stays on Products screen

**Validation:**
- Quantity must be >= 1
- Product must be available

### 6.3 Modifying Tomorrow's Delivery

**Steps:**
1. Navigate to Cart tab
2. View current milk quantity and extra products
3. Modify milk quantity using stepper
4. OR tap "Skip Tomorrow" to skip delivery
5. Add/remove extra products
6. Changes auto-save
7. Total updates in real-time

**Reset Flow:**
- If milk quantity changed → "Reset to default" button appears
- Tap to restore subscription default quantity

**Skip Flow:**
- Tap "Skip Tomorrow" → Milk section shows "Delivery Skipped"
- "Undo Skip" button appears
- Tap to restore delivery

---

## 7. RESPONSIVE BEHAVIOR

### 7.1 Mobile (Portrait)

**Screen Width:** 360px - 428px (typical)

**Layout:**
- Single column layout
- Full width cards with 20px horizontal padding
- Product grid: 2 columns
- Bottom navigation: Fixed at bottom
- Modals/sheets: Full width

**Typography:**
- Scales proportionally
- Minimum touch target: 44x44px
- Readable line lengths maintained

### 7.2 Keyboard Handling

**Login/OTP Screens:**
- Bottom panel lifts with keyboard
- AnimatedPositioned responds to viewInsets.bottom
- Smooth 220ms transition
- No content hidden

**Form Screens:**
- ScrollView with SingleChildScrollView
- resizeToAvoidBottomInset: true (default)
- Keyboard dismisses on scroll
- Submit button always accessible

**Bottom Sheets:**
- Padding adjusts for keyboard
- DraggableScrollableSheet maintains size
- Input fields scroll into view

### 7.3 Safe Area Handling

**Top Safe Area:**
- AppBar respects safe area automatically
- Custom headers use SafeArea widget

**Bottom Safe Area:**
- Bottom navigation adds safe area padding
- Buttons in sheets respect safe area
- Content padding includes safe area

### 7.4 Orientation

**Current Support:** Portrait only

**Recommendation:** Lock to portrait for consistency

---

## 8. FRICTION POINTS & RECOMMENDATIONS

### 8.1 Current Friction Points

**1. Onboarding Skip**
- Issue: Users can skip onboarding, missing value proposition
- Impact: Lower engagement, unclear app purpose
- Recommendation: Make onboarding mandatory for first-time users OR show key features in first login

**2. Profile Completion**
- Issue: Back button on Complete Profile shows logout dialog
- Impact: Confusing UX, users may accidentally logout
- Recommendation: Remove back button OR show "Complete profile to continue" message

**3. Product Images**
- Issue: Placeholder images (ghee.jpg repeated) in auth carousel
- Impact: Unprofessional appearance
- Recommendation: Replace with actual product photography

**4. Cart Auto-Save**
- Issue: No explicit "Save" or "Update" button in cart
- Impact: Users unsure if changes are saved
- Recommendation: Add subtle "Saved" indicator OR show save button with auto-save

**5. Due Amount Visibility**
- Issue: Due amount only shown on Home if > 0
- Impact: Users may not know where to check balance
- Recommendation: Always show due section with "Rs.0.00" or add to Profile tab

**6. Livestream Discovery**
- Issue: Livestream button in navbar but also in header
- Impact: Redundant navigation, unclear priority
- Recommendation: Keep in navbar only OR make header icon more prominent

**7. Notification Read Status**
- Issue: No way to mark notifications as read
- Impact: Unread dot persists
- Recommendation: Auto-mark as read when viewed OR add swipe action

**8. Order History Limit**
- Issue: Profile shows last 20 orders only
- Impact: Users can't view full history
- Recommendation: Add "View All" button OR implement pagination

### 8.2 Optimization Opportunities

**1. Loading States**
- Current: Generic circular progress
- Recommendation: Add skeleton screens for better perceived performance

**2. Empty States**
- Current: Basic icon + text
- Recommendation: Add illustrations and actionable CTAs

**3. Error Messages**
- Current: Generic error text
- Recommendation: Provide specific error messages and recovery actions

**4. Confirmation Dialogs**
- Current: Basic AlertDialog
- Recommendation: Use custom dialogs with consistent styling

**5. Image Loading**
- Current: Network images with basic error handling
- Recommendation: Add image caching and progressive loading

**6. Pull-to-Refresh**
- Current: Standard RefreshIndicator
- Recommendation: Add custom refresh animation with brand elements

**7. Animations**
- Current: Basic transitions
- Recommendation: Add micro-interactions (button press, card tap, etc.)

**8. Accessibility**
- Current: Basic Material Design accessibility
- Recommendation: Add semantic labels, screen reader support, high contrast mode

### 8.3 Feature Gaps

**1. Search Functionality**
- Missing: Product search
- Recommendation: Add search bar in Products screen

**2. Favorites/Wishlist**
- Missing: Save favorite products
- Recommendation: Add heart icon to product cards

**3. Order Tracking**
- Missing: Real-time delivery tracking
- Recommendation: Add map view or status timeline

**4. Payment Integration**
- Missing: In-app payment
- Recommendation: Integrate payment gateway for due amount

**5. Referral System**
- Missing: Refer friends feature
- Recommendation: Add referral code sharing

**6. Notifications Settings**
- Missing: Notification preferences
- Recommendation: Add settings screen for notification control

**7. Help/Support**
- Missing: FAQ or chat support
- Recommendation: Add help section in Profile tab

**8. Subscription History**
- Missing: View past subscriptions
- Recommendation: Add subscription history in Subscription screen

---

## CONCLUSION

This documentation provides a comprehensive overview of the Dairy Milk Subscription and Product Booking Application's frontend UI/UX. The app follows a clean, modern design language with consistent spacing, typography, and color usage. The user journey is straightforward, with clear navigation and intuitive interactions.

**Key Strengths:**
- Consistent design system with reusable components
- Clear visual hierarchy and information architecture
- Smooth animations and transitions
- Responsive to keyboard and safe areas
- Premium card-based layout with soft shadows

**Areas for Improvement:**
- Replace placeholder images with actual product photography
- Add more robust error handling and recovery flows
- Implement skeleton loading states
- Enhance accessibility features
- Add missing features (search, payment, tracking)

**Next Steps:**
1. Conduct usability testing with target users
2. Implement recommended optimizations
3. Add missing features based on priority
4. Perform accessibility audit
5. Optimize performance (image loading, API calls)
6. Add analytics tracking for user behavior

---

**Document Version:** 1.0  
**Last Updated:** April 23, 2026  
**Prepared For:** UI/UX Review and Optimization
