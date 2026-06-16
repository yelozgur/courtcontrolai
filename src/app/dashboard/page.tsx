
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Trophy, 
  Users, 
  Calendar, 
  Activity, 
  Play, 
  Clock, 
  ArrowUpRight,
  TrendingUp,
  MapPin,
  Zap
} from "lucide-react"

export default function DashboardOverview() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Real-time pulse of your sports club and tournaments.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Export Data</Button>
          <Button className="bg-primary hover:bg-primary/90">
            <Play className="mr-2 h-4 w-4" /> Start Live Mode
          </Button>
        </div>
      </div>

      {/* Stats Quick View */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/50 border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Tournaments</CardTitle>
            <Trophy className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <Activity className="mr-1 h-3 w-3 text-accent" /> 2 live matches now
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Registered Players</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">128</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1 text-accent">
              <TrendingUp className="mr-1 h-3 w-3" /> +12% from last month
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Courts Available</CardTitle>
            <MapPin className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">6 / 8</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <Clock className="mr-1 h-3 w-3" /> 2 scheduled for maintenance
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Score Verifications</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">98.4%</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1 text-accent">
              Accuracy verified via Telegram
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bento Grid Content */}
      <div className="grid gap-6 md:grid-cols-6 lg:grid-cols-12 auto-rows-[200px]">
        {/* Active Tournament Card */}
        <Card className="md:col-span-3 lg:col-span-8 row-span-2 bg-gradient-to-br from-card to-background border-border overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Trophy className="w-32 h-32" />
          </div>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge className="bg-accent text-accent-foreground mb-2">LIVE NOW</Badge>
              <Button size="sm" variant="ghost" className="text-primary hover:text-primary hover:bg-primary/10">
                View Full Bracket <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <CardTitle className="text-3xl font-headline font-bold">Spring Padel Open 2024</CardTitle>
            <CardDescription>Multi-Category Elimination Tournament • 48 Teams</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl pulse-active">
                <div className="flex flex-col flex-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Court 1 • Pro Men</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-bold">Team Smith/Doe</span>
                    <span className="text-accent font-bold">6 - 4 - 15</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold">Team Brown/White</span>
                    <span className="text-muted-foreground font-bold">4 - 6 - 0</span>
                  </div>
                </div>
                <div className="h-10 w-[2px] bg-border"></div>
                <div className="text-center px-2">
                  <span className="block text-[10px] text-muted-foreground uppercase font-bold">Set 3</span>
                  <span className="block font-headline font-bold text-lg">LIVE</span>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-secondary/10 rounded-xl border border-border/50">
                <div className="flex flex-col flex-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Court 2 • Mixed Doubles</span>
                  <div className="flex items-center justify-between mt-1 opacity-50">
                    <span className="font-bold">Team Rossi/Lopez</span>
                    <span className="font-bold">Waiting...</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="border-accent text-accent hover:bg-accent/10">Assign Ref</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Schedule Insights */}
        <Card className="md:col-span-3 lg:col-span-4 row-span-2 bg-card border-border">
          <CardHeader>
            <CardTitle className="font-headline font-bold">Schedule Snapshot</CardTitle>
            <CardDescription>Upcoming 4 matches</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-3 p-2 hover:bg-secondary/20 rounded-lg transition-colors cursor-pointer group">
                <div className="w-12 text-center py-1 bg-secondary rounded font-mono text-sm">
                  1{i}:00
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold group-hover:text-primary transition-colors">Quarter Finals - Cat B</p>
                  <p className="text-xs text-muted-foreground">Court {i} • Ref: Mark Wilson</p>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full mt-2">Open Visual Timeline</Button>
          </CardContent>
        </Card>

        {/* Player Stats Hub Snapshot */}
        <Card className="md:col-span-3 lg:col-span-6 row-span-1 bg-card border-border flex items-center p-6 gap-6">
          <div className="p-4 bg-primary/20 rounded-full">
            <Activity className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h4 className="font-headline font-bold text-xl">Global Player Hub</h4>
            <p className="text-sm text-muted-foreground">12 new social assets generated this hour by players.</p>
          </div>
        </Card>

        {/* Smart Scheduler Status */}
        <Card className="md:col-span-3 lg:col-span-6 row-span-1 bg-card border-border border-l-4 border-l-accent flex items-center p-6 gap-6">
          <div className="p-4 bg-accent/20 rounded-full">
            <Zap className="h-8 w-8 text-accent" />
          </div>
          <div className="flex-1">
            <h4 className="font-headline font-bold text-xl">OR-Tools Optimizer</h4>
            <p className="text-sm text-muted-foreground">Scheduling engine is active and monitoring court usage.</p>
          </div>
          <Badge variant="outline" className="text-accent border-accent">Optimized</Badge>
        </Card>
      </div>
    </div>
  )
}
