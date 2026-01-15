# Goal-Backward Planning

How to derive requirements by working backwards from the goal, not forwards from tasks.

<core_principle>
**Forward planning asks:** "What should we build?"
**Goal-backward planning asks:** "What must be TRUE for the goal to be achieved?"

Forward planning produces tasks. Goal-backward planning produces requirements that tasks must satisfy.
</core_principle>

<why_this_matters>
Forward planning fails silently. A task like "create chat component" can be marked complete when the component is a placeholder. The task was done—a component was created—but the goal "working chat interface" was not achieved.

Goal-backward planning starts from "user can chat" and works backwards:
- What must be TRUE for a user to chat?
- What must EXIST for those truths to hold?
- What must be WIRED for those artifacts to function?

This produces must-haves that are verifiable. Either a user CAN chat, or they can't. No ambiguity.
</why_this_matters>

<the_process>

## Step 1: State the Goal

Take the phase goal from ROADMAP.md. This is the outcome, not the work.

**Examples:**
- "Working chat interface" (not "build chat components")
- "Users can authenticate" (not "implement auth system")
- "Products display with prices" (not "create product pages")

If the roadmap goal is task-shaped ("implement X"), reframe it as outcome-shaped ("X works").

## Step 2: Derive Observable Truths

Ask: **"What must be TRUE for this goal to be achieved?"**

List 3-7 truths from the USER's perspective. These are observable behaviors, not implementation details.

**For "working chat interface":**
- User can see existing messages
- User can type a new message
- User can send the message
- Sent message appears in the list
- Messages persist across page refresh

**For "users can authenticate":**
- User can reach login page
- User can enter credentials
- Valid credentials grant access
- Invalid credentials show error
- Session persists across refresh
- User can log out

**Test:** Each truth should be verifiable by a human using the application. If you can't test it by clicking around, it's not observable.

## Step 3: Derive Required Artifacts

For each truth, ask: **"What must EXIST for this to be true?"**

Map truths to concrete artifacts (files, routes, schemas, components).

**"User can see existing messages" requires:**
- Message list component (renders Message[])
- Messages state (loaded from somewhere)
- API route or data source (provides messages)
- Message type definition (shapes the data)

**"Valid credentials grant access" requires:**
- Login form component (captures credentials)
- Auth API route (validates credentials)
- Session/token mechanism (persists auth state)
- User record in database (to validate against)

**Test:** Each artifact should be a specific file or database object. If you can't point to where it lives, it's too abstract.

## Step 4: Derive Required Wiring

For each artifact, ask: **"What must be CONNECTED for this artifact to function?"**

Wiring is where most failures hide. The pieces exist but don't talk to each other.

**Message list component wiring:**
- Imports Message type (not using `any`)
- Receives messages prop or fetches from API
- Maps over messages to render (not hardcoded)
- Handles empty state (not just crashes)

**Auth API route wiring:**
- Imports database client
- Queries users table (not placeholder)
- Compares password hash (not plaintext)
- Returns session token (not empty response)

**Test:** Wiring is verified by tracing data flow. Does A actually call B? Does B actually return to A? Does A actually use what B returned?

## Step 5: Identify Key Links

Ask: **"Where is this most likely to break?"**

Key links are the critical connections that, if missing, cause cascading failures.

**For chat interface:**
- Input onSubmit → API call (if broken: typing works but sending doesn't)
- API save → database (if broken: appears to send but doesn't persist)
- Component → real data (if broken: shows placeholder, not messages)

**For authentication:**
- Form submit → API (if broken: form works but auth doesn't)
- API → database query (if broken: accepts any password)
- Session → protected routes (if broken: logged in but can't access anything)

Key links get extra verification attention. These are where stubs and placeholders hide.

</the_process>

<output_format>
The derive_must_haves step produces a structured list for PLAN.md frontmatter:

```yaml
must_haves:
  truths:
    - "User can see existing messages"
    - "User can send a message"
    - "Messages persist across refresh"
  artifacts:
    - path: "src/components/Chat.tsx"
      provides: "Message list rendering"
    - path: "src/app/api/chat/route.ts"
      provides: "Message CRUD operations"
    - path: "prisma/schema.prisma"
      provides: "Message model"
  key_links:
    - from: "Chat.tsx"
      to: "api/chat"
      via: "fetch in useEffect"
    - from: "api/chat POST"
      to: "database"
      via: "prisma.message.create"
```

This structure is machine-readable for verification after execution.
</output_format>

<examples>

## Example 1: E-commerce Product Page

**Goal:** "Products display with prices and add-to-cart"

**Truths:**
- User can see product image
- User can see product name and description
- User can see product price
- User can click "Add to Cart"
- Cart updates when product added

**Artifacts:**
- `src/components/ProductCard.tsx` - displays product info
- `src/components/AddToCart.tsx` - button with cart logic
- `src/app/products/[id]/page.tsx` - product detail page
- `src/hooks/useCart.ts` - cart state management
- `prisma/schema.prisma` - Product model with price field

**Key Links:**
- ProductCard receives product data (not hardcoded)
- AddToCart calls cart hook (not just console.log)
- useCart persists to localStorage or API (not just memory)
- Price displays from product.price (not placeholder "$XX.XX")

---

## Example 2: User Settings Page

**Goal:** "Users can update their profile settings"

**Truths:**
- User can see current settings values
- User can edit each setting field
- User can save changes
- Saved changes persist
- User sees confirmation of save

**Artifacts:**
- `src/app/settings/page.tsx` - settings page
- `src/components/SettingsForm.tsx` - form with fields
- `src/app/api/settings/route.ts` - GET and PUT endpoints
- `prisma/schema.prisma` - User model with settings fields

**Key Links:**
- Form loads current values on mount (not empty defaults)
- Submit calls API with form data (not console.log)
- API updates database (not just returns success)
- Success triggers UI feedback (not silent)

---

## Example 3: Real-time Notifications

**Goal:** "Users receive notifications in real-time"

**Truths:**
- User sees notification badge/indicator
- New notifications appear without refresh
- User can view notification list
- User can mark notifications as read
- Read state persists

**Artifacts:**
- `src/components/NotificationBell.tsx` - badge/indicator
- `src/components/NotificationList.tsx` - dropdown/panel
- `src/app/api/notifications/route.ts` - CRUD endpoints
- `src/hooks/useNotifications.ts` - real-time subscription
- `prisma/schema.prisma` - Notification model

**Key Links:**
- useNotifications connects to WebSocket/SSE (not polling placeholder)
- NotificationBell shows actual unread count (not hardcoded)
- Mark-as-read calls API (not just local state)
- API broadcasts to other clients (if multi-device)

</examples>

<common_failures>

## Failure: Truths Too Vague

**Bad:** "User can use chat"
**Good:** "User can see messages", "User can send message", "Messages persist"

Vague truths can't be verified. Break them into specific, observable behaviors.

## Failure: Artifacts Too Abstract

**Bad:** "Chat system", "Auth module"
**Good:** "src/components/Chat.tsx", "src/app/api/auth/login/route.ts"

Abstract artifacts can't be checked. Point to specific files.

## Failure: Missing Wiring

**Bad:** Listing components without how they connect
**Good:** "Chat.tsx fetches from /api/chat via useEffect on mount"

Artifacts existing isn't enough. The connections between them are where stubs hide.

## Failure: Skipping Key Links

**Bad:** Assuming "if files exist, it works"
**Good:** Identifying the 2-3 critical connections that make-or-break the goal

Key links are verification priorities. Without them, you check everything equally (inefficient) or check nothing deeply (ineffective).

</common_failures>

<integration_with_gsd>

## In plan-phase.md

The `derive_must_haves` step runs after gathering context, before breaking into tasks.

Output: `must_haves` structure written to PLAN.md frontmatter.

Tasks are then designed to CREATE the artifacts and ESTABLISH the wiring.

## In execute-phase.md

The `verify_phase_goal` step runs after all plans execute, before updating roadmap.

Input: `must_haves` from PLAN.md frontmatter (or derived from goal if missing).

Process: Check each truth against codebase, verify artifacts exist and aren't stubs, trace key links.

Output: VERIFICATION.md with pass/fail per item, fix recommendations if gaps found.

## The Loop

```
derive_must_haves → tasks → execute → verify → [gaps?] → fix plans → execute → verify → pass
```

Must-haves are derived once, verified as many times as needed until all pass.

</integration_with_gsd>
