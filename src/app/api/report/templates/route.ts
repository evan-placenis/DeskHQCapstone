import { NextResponse } from 'next/server';
import { ObservationReportTemplate } from '@/src/backend/src/domain/reports/templates/report_templates';

export async function GET() {
  // Map Backend Template to Frontend Format
  const templates = [
    {
      id: 'observation',
      name: 'Observation Report',
      description: 'General site observations with photos and field notes',
      icon: 'ClipboardList', // We send string name, frontend maps to icon
      sections: ObservationReportTemplate[0].reportContent.map(s => ({
        title: s.title
      }))
    }
  ];

  return NextResponse.json(templates);
}
