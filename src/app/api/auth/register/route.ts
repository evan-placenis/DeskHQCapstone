import { NextResponse } from "next/server";
import { Container } from '@/backend/config/container';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, fullName, organizationName, password } = body;

    if (!email || !fullName || !organizationName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Call the Service
    const newUser = await Container.userService.registerUser(email, fullName, organizationName, password);

    return NextResponse.json({ 
        success: true, 
        user: newUser,
        message: "User registered successfully."
    }, { status: 201 });

  } catch (error: any) {
    console.error("❌ Registration Error:", error);
    return NextResponse.json(
      { error: error.message || "Registration failed" },
      { status: 500 }
    );
  }
}

