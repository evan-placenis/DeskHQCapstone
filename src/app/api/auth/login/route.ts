import { NextResponse } from "next/server";
import { Container } from '@/backend/config/container';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
    }

    // Call the Service (We need to add this method to UserService first)
    const session = await Container.userService.loginUser(email, password);

    if (!session) {
       return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    return NextResponse.json({ 
        success: true, 
        session: session
    }, { status: 200 });

  } catch (error: any) {
    console.error("❌ Login Error:", error);
    return NextResponse.json(
      { error: error.message || "Login failed" },
      { status: 500 }
    );
  }
}

