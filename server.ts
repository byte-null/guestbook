import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";

const app = new Application();
const port = 8080;
const router = new Router();
const kv = await Deno.openKv();

app.use(router.routes());
app.use(router.allowedMethods());

router.post("/submit", async (context) => {
  const form = await context.request.body().value;
  const requiredFields = ["name", "message", "g-recaptcha-response"];

  for (const field of requiredFields) {
    if (!form.has(field) || form.get(field) === "") {
      context.response.body = `<span>Missing ${field}</span>`;
      return;
    }
  }

  const recaptcha = await fetch(
    "https://www.google.com/recaptcha/api/siteverify",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `secret=${Deno.env.get("RECAPTCHA_SECRET")}&response=${
        form.get("g-recaptcha-response")
      }`,
    },
  ).then((res) => res.json());

  if (!recaptcha.success) {
    context.response.body = `<span>Failed recaptcha</span>`;
    return;
  }

  const guest_id = crypto.randomUUID();
  const data = {
    id: guest_id,
    name: form.get("name"),
    message: form.get("message"),
    timestamp: new Date().toISOString(),
  };

  await kv.set(["guestbook", guest_id], data);

  context.response.body = `<span>Success</span>`;
});

router.get("/guestbook", async (context) => {
  const iter = kv.list<any>({ prefix: ["guestbook"] });
  const entries = [];
  for await (const { value } of iter) {

    entries.push(`<div class="card">
    <span>
    ${value.name}
    </span>
    <p>
    ${value.message}
    </p>
    </div>`);
  }

  context.response.body = entries.join("");

  return;
});

app.use(async (context) => {
  await context.send({
    root: `${Deno.cwd()}/public/`,
    index: "index.html",
  });
});

console.log("Listening at http://localhost:" + port);
await app.listen({ port });
