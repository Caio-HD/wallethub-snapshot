import React, { ElementType } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Percent, AlertTriangle, Zap, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { usePerformanceMetrics } from './useInvestments';

const MetricCard = ({ title, value, icon: Icon, description, trend, suffix = '%' }: {
  title: string;
  value: number;
  icon: ElementType;
  description: string;
  trend?: number;
  suffix?: string;
}) => (
  <motion.div
    whileHover={{ y: -5 }}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <Card className="h-full bg-slate-900/50 border-slate-800 backdrop-blur-sm hover:border-slate-700 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-400">{title}</CardTitle>
        <Icon className="h-4 w-4 text-emerald-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-white">
          {(value * 100).toFixed(2)}{suffix}
        </div>
        <p className="text-xs text-slate-500 mt-1">{description}</p>
        {trend && (
          <div className={`text-xs mt-2 flex items-center ${trend > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            <TrendingUp className="h-3 w-3 mr-1" />
            {trend}% vs benchmark
          </div>
        )}
      </CardContent>
    </Card>
  </motion.div>
);

export const MetricsBentoGrid = () => {
  const { data: metrics, isLoading } = usePerformanceMetrics();

  if (isLoading || !metrics) return <div className="animate-pulse h-48 bg-slate-800 rounded-xl" />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <MetricCard
        title="TWR (Time-Weighted)"
        value={metrics.twr}
        icon={TrendingUp}
        description="Retorno real do período"
      />
      <MetricCard
        title="Sharpe Ratio"
        value={metrics.sharpeRatio / 100}
        icon={Percent}
        suffix=""
        description="Retorno ajustado ao risco"
      />
      <MetricCard
        title="Max Drawdown"
        value={metrics.maxDrawdown}
        icon={AlertTriangle}
        description="Maior queda histórica"
      />
      <div className="grid grid-cols-1 xs:grid-cols-2 gap-4 col-span-1 md:col-span-2 lg:col-span-1">
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 backdrop-blur-sm">
          <div className="text-xs text-slate-400 flex items-center">
            <Zap className="h-3 w-3 mr-1 text-yellow-400" /> Alpha
          </div>
          <div className="text-lg font-bold text-white mt-1">{(metrics.alpha * 100).toFixed(2)}%</div>
        </div>
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 backdrop-blur-sm">
          <div className="text-xs text-slate-400 flex items-center">
            <Target className="h-3 w-3 mr-1 text-blue-400" /> Beta
          </div>
          <div className="text-lg font-bold text-white mt-1">{metrics.beta.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
};
