import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 950 },
  acceptDownloads: true,
});
const page = await context.newPage();
const base = "https://eczpcryjwjctaljfpaod.supabase.co";
const app = "http://127.0.0.1:5175";
const uid = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002",
  ws = "20000000-0000-4000-8000-000000000001",
  cid = "30000000-0000-4000-8000-000000000001";
const codes = ["akar", "mastura", "trust", "amiza", "kugiran"];
const companyRows = codes.map((code, i) => ({
  id: `40000000-0000-4000-8000-00000000000${i + 1}`,
  workspace_id: ws,
  code,
  name: [
    "Akar Sepakat Sdn Bhd",
    "Mastura",
    "Trust Me",
    "Amiza",
    "Kugiran Sdn Bhd",
  ][i],
}));
const now = new Date().toISOString();
const rows = {
  companies: companyRows,
  clients: [{ id: cid, workspace_id: ws, name: "Sunway" }],
  jobs: [],
  job_expenses: [],
  overhead_costs: [],
  attachments: [],
};
let active = uid,
  member = false,
  signupCalled = false,
  resetCalled = false,
  passwordChanged = false,
  jobRPC = false,
  storageDeleted = false;
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
function user(id = active) {
  return {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: id === uid ? "admin@example.invalid" : "other@example.invalid",
    email_confirmed_at: now,
    created_at: now,
    user_metadata: { full_name: id === uid ? "QA Admin" : "Other User" },
    app_metadata: { provider: "email", providers: ["email"] },
  };
}
function session() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const encode = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
  return {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: active, email: user().email, role: "authenticated", aud: "authenticated", exp, iat: exp - 3600, iss: base + "/auth/v1" })}.test-signature`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    refresh_token: "test-refresh-token",
    user: user(),
  };
}
function response(data, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  };
}
await page.route(base + "/**", async (route) => {
  const request = route.request(),
    u = new URL(request.url()),
    path = u.pathname,
    method = request.method();
  const body =
    method === "GET" ||
    method === "HEAD" ||
    !(request.headers()["content-type"] ?? "").includes("application/json")
      ? null
      : request.postDataJSON();
  if (path.startsWith("/auth/v1/")) {
    if (path.endsWith("/signup")) {
      signupCalled = true;
      assert.equal(body.email, "admin@example.invalid");
      return route.fulfill(response({ user: user(uid), session: null }));
    }
    if (path.endsWith("/token")) {
      if (body.password !== "Test-only-password-123!")
        return route.fulfill(
          response(
            { code: "invalid_credentials", msg: "Invalid login credentials" },
            400,
          ),
        );
      active = body.email === "other@example.invalid" ? other : uid;
      return route.fulfill(response(session()));
    }
    if (path.endsWith("/logout"))
      return route.fulfill({ status: 204, body: "" });
    if (path.endsWith("/recover")) {
      resetCalled = true;
      return route.fulfill(response({}));
    }
    if (path.endsWith("/user")) {
      if (method === "PUT") passwordChanged = true;
      return route.fulfill(response({ user: user(), ...user() }));
    }
    return route.fulfill(response({}));
  }
  assert.match(request.headers().authorization ?? "", /^Bearer /);
  if (path.startsWith("/storage/v1/")) {
    if (method === "DELETE") {
      storageDeleted = true;
      return route.fulfill(response([]));
    }
    if (method === "GET")
      return route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZryAAAAAASUVORK5CYII=",
          "base64",
        ),
      });
    return route.fulfill(response({ Key: "test", Id: "test" }));
  }
  const table = path.split("/").at(-1);
  if (path.includes("/rpc/")) {
    if (table === "create_construction_workspace") {
      if (active !== uid)
        return route.fulfill(
          response(
            {
              code: "42501",
              message:
                "This account has not been approved for administrator setup.",
            },
            403,
          ),
        );
      member = true;
      return route.fulfill(response(ws));
    }
    if (table === "save_construction_job") {
      jobRPC = true;
      assert.equal(body.target_workspace, ws);
      const input = body.job_data,
        record = {
          id: input.id,
          workspace_id: ws,
          job_number: "JOB-0001",
          company_id: companyRows.find((c) => c.code === input.company_code).id,
          client_id: cid,
          work_type: input.work_type,
          custom_work_type: input.custom_work_type,
          price: Number(input.price),
          location_address: input.location_address,
          latitude: input.latitude,
          longitude: input.longitude,
          job_date: input.job_date,
          description: input.description,
          status: input.status,
          created_by: uid,
          created_at: now,
          updated_at: now,
        };
      rows.jobs = [record];
      return route.fulfill(response(record));
    }
  }
  const wantsObject = (request.headers().accept ?? "").includes(
    "vnd.pgrst.object",
  );
  let data;
  if (table === "workspace_members")
    data =
      member && active === uid
        ? [{ workspace_id: ws, user_id: uid, role: "admin", created_at: now }]
        : [];
  else if (table === "workspaces")
    data = [{ id: ws, name: "QA Construction group" }];
  else if (table === "users")
    data = [{ id: uid, name: "QA Admin", email: "admin@example.invalid" }];
  else data = rows[table] ?? [];
  if (method === "POST") {
    const record = {
      ...body,
      created_at: now,
      updated_at: now,
      created_by: uid,
      uploaded_by: uid,
    };
    if (record.amount) record.amount = Number(record.amount);
    rows[table].push(record);
    return route.fulfill(response(wantsObject ? record : [record], 201));
  }
  if (method === "PATCH") {
    const id = u.searchParams.get("id")?.replace("eq.", "");
    const record = rows[table].find((r) => r.id === id);
    Object.assign(record, body, { updated_at: now });
    return route.fulfill(response(wantsObject ? record : [record]));
  }
  if (method === "DELETE") {
    const id = u.searchParams.get("id")?.replace("eq.", "");
    const deleted = rows[table].filter((r) => r.id === id);
    rows[table] = rows[table].filter((r) => r.id !== id);
    return route.fulfill(response(deleted));
  }
  return route.fulfill(response(wantsObject ? (data[0] ?? null) : data));
});
const dialog = () => page.getByRole("dialog").last();
try {
  await page.goto(app, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  assert.equal(await page.locator(".company-card").count(), 0);
  await page
    .getByRole("button", { name: "First-time administrator setup" })
    .click();
  await page.locator("input[name=name]").fill("QA Admin");
  await page.locator("input[name=email]").fill("admin@example.invalid");
  await page.locator("input[name=password]").fill("Test-only-password-123!");
  await page
    .locator("input[name=confirmPassword]")
    .fill("Test-only-password-123!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Check your inbox" })
    .waitFor();
  assert.ok(signupCalled);
  assert.equal(await page.locator(".company-card").count(), 0);
  await page.locator("input[name=password]").fill("wrong");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("alert").waitFor();
  await page.locator("input[name=password]").fill("Test-only-password-123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("heading", { name: "Your workspace starts here." })
    .waitFor();
  await page.locator("input[name=workspaceName]").fill("QA Construction group");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await page.getByRole("heading", { name: /Choose a company/ }).waitFor();
  assert.equal(await page.locator(".company-card").count(), 5);
  assert.equal(rows.jobs.length, 0);
  assert.equal(
    await page.getByRole("button", { name: "JOB-1048", exact: true }).count(),
    0,
  );
  await page.getByText("Live workspace", { exact: true }).waitFor();
  await page.screenshot({
    path: "outputs/live-workspace-empty.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.locator(".company-card").first().click();
  await dialog().locator("input[name=price]").fill("15000");
  await dialog().locator("input[name=location]").fill("Shah Alam, Selangor");
  await dialog().getByRole("button", { name: "Save job", exact: true }).click();
  await page.getByRole("button", { name: "JOB-0001", exact: true }).waitFor();
  assert.ok(jobRPC);
  await page.getByRole("button", { name: "JOB-0001", exact: true }).click();
  await dialog()
    .locator("input[type=file]")
    .setInputFiles({
      name: "receipt.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZryAAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await dialog()
    .getByRole("button", { name: "receipt.png", exact: true })
    .waitFor();
  assert.equal(rows.attachments.length, 1);
  assert.match(rows.attachments[0].storage_path, new RegExp("^" + ws + "/"));
  await dialog().getByRole("button", { name: "Manage expenses" }).click();
  await page
    .getByRole("button", { name: "Add expense", exact: true })
    .first()
    .click();
  await dialog().locator("input[name=description]").fill("Cloud materials");
  await dialog().locator("input[name=amount]").fill("3900.00");
  await dialog()
    .getByRole("button", { name: "Add expense", exact: true })
    .click();
  await page.getByText("Cloud materials", { exact: true }).waitFor();
  await page
    .getByText(/11,100/)
    .first()
    .waitFor();
  assert.equal(rows.job_expenses[0].amount, 3900);
  await page.reload();
  await page.getByText("Cloud materials", { exact: true }).waitFor();
  assert.equal(rows.jobs[0].price, 15000);
  await page
    .locator(".sidebar nav")
    .getByRole("link", { name: "Overhead costs" })
    .click();
  await page.getByRole("button", { name: "Add overhead", exact: true }).click();
  await dialog().locator("input[name=description]").fill("Cloud office rental");
  await dialog().locator("input[name=amount]").fill("2000");
  await dialog()
    .getByRole("button", { name: "Add overhead", exact: true })
    .click();
  await page.getByText("Cloud office rental", { exact: true }).waitFor();
  assert.equal(rows.overhead_costs.length, 1);
  await page
    .locator(".sidebar nav")
    .getByRole("link", { name: "Reports" })
    .click();
  await page.getByRole("heading", { name: "Financial reports." }).waitFor();
  await page.getByText(/9,100/).first().waitFor();
  await page
    .getByRole("button", { name: "Search workspace", exact: true })
    .click();
  await dialog().getByLabel("Search workspace jobs").fill("JOB-0001");
  await dialog()
    .getByRole("button", { name: /JOB-0001/ })
    .click();
  await dialog().getByRole("button", { name: "Delete receipt.png" }).click();
  await dialog().getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByText("Attachment deleted", { exact: true }).waitFor();
  assert.ok(storageDeleted);
  assert.equal(rows.attachments.length, 0);
  await dialog()
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  assert.equal(await page.locator(".company-card").count(), 0);
  await page.reload();
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  await page.locator("input[name=email]").fill("other@example.invalid");
  await page.locator("input[name=password]").fill("Test-only-password-123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("heading", { name: "Your workspace starts here." })
    .waitFor();
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "not been approved" })
    .waitFor();
  assert.equal(await page.locator(".company-card").count(), 0);
  await page.getByRole("button", { name: "Use another account" }).click();
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.locator("input[name=email]").fill("admin@example.invalid");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "password-reset link" })
    .waitFor();
  assert.ok(resetCalled);
  active = uid;
  const recovery = session();
  await page.goto(
    app +
      "/auth/callback#access_token=" +
      encodeURIComponent(recovery.access_token) +
      "&refresh_token=" +
      recovery.refresh_token +
      "&expires_in=3600&token_type=bearer&type=recovery",
  );
  await page.getByRole("heading", { name: "Choose a new password." }).waitFor();
  await page.locator("input[name=password]").fill("Another-test-password-123!");
  await page
    .locator("input[name=confirmPassword]")
    .fill("Another-test-password-123!");
  await page.getByRole("button", { name: "Save new password" }).click();
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  assert.ok(passwordChanged);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "outputs/live-login-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: protected routes, signup confirmation, invalid/valid login, approved onboarding, cloud job/expense/overhead/file saving, reload persistence, reports, logout isolation, unauthorized bootstrap denial, password recovery and mobile login. All remote services were mocked; no emails or real accounts were created by this test.",
  );
} finally {
  await browser.close();
}
