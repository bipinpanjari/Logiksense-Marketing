"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const days = [
  { date: "Mon 18", sent: 42, meetings: 4, booked: 2 },
  { date: "Tue 19", sent: 38, meetings: 3, booked: 1 },
  { date: "Wed 20", sent: 51, meetings: 5, booked: 2 },
  { date: "Thu 21", sent: 46, meetings: 4, booked: 3 },
  { date: "Fri 22", sent: 29, meetings: 2, booked: 1 },
];

export default function EmailCalendarPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Campaign Calendar</h1>
        <p className="text-sm text-muted-foreground">Weekly operational timeline for sends and outcomes.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {days.map((day) => (
          <Card key={day.date}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{day.date}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                Emails sent: <span className="font-medium">{day.sent}</span>
              </p>
              <p>
                Meetings: <span className="font-medium">{day.meetings}</span>
              </p>
              <p>
                Booked: <span className="font-medium">{day.booked}</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

