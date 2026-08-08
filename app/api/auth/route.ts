import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = formData.get("password") as string;
  const from = formData.get("from") as string || "/";

  if (password === process.env.SITE_PASSWORD) {
    const cookieStore = await cookies();
    cookieStore.set("garden_session", password, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
    redirect(from);
  }

  redirect(`/login?error=1&from=${encodeURIComponent(from)}`);
}
