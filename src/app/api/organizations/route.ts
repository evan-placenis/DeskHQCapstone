import { NextResponse } from "next/server";
import { Container } from '@/backend/config/container';

export async function GET() {
  try {
    const organizations = await Container.userService.getAllOrganizations();
    return NextResponse.json(organizations);
  } catch (error: any) {
    console.error("Error fetching organizations:", error);
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 }
    );
  }
}

