import { NextResponse } from "next/server";

import { signIn } from "@/lib/actions/auth.action";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await signIn({ email: body?.email, idToken: body?.idToken });
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid sign-in request." },
      { status: 400 }
    );
  }
}
