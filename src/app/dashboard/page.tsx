// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useCompany } from '@/lib/contexts/CompanyContext';
import * as XLSX from 'xlsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DailySummary {
  date: string;
  nps_average: number;
  positive_themes: string[];
  negative_themes: string[];
  summary: string;
}

interface FeedbackEntry {
  id: string;
  created_at: string;
  order_id: string;
  nps_score: number;
  transcription: string | null;
  voice_file_url: string | null;
  feedback_campaigns: {
    name: string;
    questions: Array<{
      id: string;
      text: string;
      type: string;
    }>;
  };
  question_responses: Array<{
    question_id: string;
    response_value: string;
  }>;
}

interface DashboardData {
  dailySummaries: DailySummary[];
  recentFeedback: FeedbackEntry[];
}

interface FeedbackExcelData {
  'Date': string;
  'Campaign': string;
  'Order ID': string;
  'NPS Score': number;
  'Has Voice Recording': string;
  'Feedback': string;
  [key: string]: string | number; // This allows dynamic property names
}

export default function DashboardPage() {
  const company = useCompany();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisRunning, setAnalysisRunning] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/dashboard?limit=30&timestamp=${timestamp}`, {
        cache: 'no-store',
        next: { revalidate: 0 },
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      setData(result);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const intervalId = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const runAnalysis = async () => {
    try {
      setAnalysisRunning(true);
      const response = await fetch('/api/run-analysis?days=30', {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error('Failed to run analysis');
      }
      await fetchDashboardData();
      alert('Sentiment analysis complete! The dashboard has been updated with the latest feedback analysis.');
    } catch (error) {
      console.error('Error running analysis:', error);
      alert('Failed to run analysis. Check console for details.');
    } finally {
      setAnalysisRunning(false);
    }
  };

  const exportToExcel = () => {
    if (!data) return;

    const { recentFeedback, dailySummaries } = data;

    // Prepare feedback data
    const feedbackData = recentFeedback.map(feedback => {
      // Get the questions from the campaign
      const campaignQuestions = feedback.feedback_campaigns.questions || [];
      
      // Create a map of question responses
      const responseMap = new Map(
        feedback.question_responses.map((r) => [r.question_id, r.response_value])
      );

      // Base feedback data
      const baseData: FeedbackExcelData = {
        'Date': new Date(feedback.created_at).toLocaleDateString(),
        'Campaign': feedback.feedback_campaigns.name,
        'Order ID': feedback.order_id,
        'NPS Score': feedback.nps_score,
        'Has Voice Recording': feedback.voice_file_url ? 'Yes' : 'No',
        'Feedback': feedback.transcription || '',
      };

      // Add question responses
      campaignQuestions.forEach((question) => {
        baseData[`Q: ${question.text}`] = responseMap.get(question.id) || '';
      });

      return baseData;
    });

    // Prepare summaries data
    const summariesData = dailySummaries.map(summary => ({
      'Date': new Date(summary.date).toLocaleDateString(),
      'NPS Score': summary.nps_average,
      'Positive Themes': summary.positive_themes?.join(', ') || '',
      'Negative Themes': summary.negative_themes?.join(', ') || '',
      'Summary': summary.summary
    }));

    // Create workbook and add worksheets
    const wb = XLSX.utils.book_new();
    
    const feedbackSheet = XLSX.utils.json_to_sheet(feedbackData);
    XLSX.utils.book_append_sheet(wb, feedbackSheet, "Feedback");
    
    const summariesSheet = XLSX.utils.json_to_sheet(summariesData);
    XLSX.utils.book_append_sheet(wb, summariesSheet, "Daily Summaries");

    // Generate Excel file
    XLSX.writeFile(wb, `feedback-export-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">{error || 'Failed to load data'}</div>
      </div>
    );
  }

  const { dailySummaries, recentFeedback } = data;

  // Prepare data for NPS trend chart
  const chartData = dailySummaries
    .map(summary => ({
      date: new Date(summary.date).toLocaleDateString(),
      nps: summary.nps_average
    }))
    .reverse();

  // Calculate overall NPS average
  const overallNPS = dailySummaries.length
    ? dailySummaries.reduce((acc, curr) => acc + (curr.nps_average || 0), 0) / dailySummaries.length
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">{company.name} Feedback Dashboard</h1>
        <div className="flex gap-4">
          <button
            onClick={exportToExcel}
            className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded transition-colors"
          >
            Export to Excel
          </button>
          <button
            onClick={runAnalysis}
            disabled={analysisRunning}
            className={`${
              analysisRunning 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-500 hover:bg-blue-600'
            } text-white font-semibold py-2 px-4 rounded transition-colors`}
          >
            {analysisRunning ? 'Analyzing Sentiment...' : 'Analyze Feedback Sentiment'}
          </button>
        </div>
      </div>
      
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">30-Day NPS Score</h3>
          <p className="text-3xl font-bold">{overallNPS.toFixed(1)}</p>
          <p className="text-sm text-gray-500 mt-1">
            Range: -100 to 100
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">Total Responses</h3>
          <p className="text-3xl font-bold">{recentFeedback.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">Voice Recordings</h3>
          <p className="text-3xl font-bold">
            {recentFeedback.filter(f => f.voice_file_url).length}
          </p>
        </div>
      </div>

      {/* NPS Trend Chart */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">NPS Score Trend</h2>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis 
                domain={[-100, 100]} 
                ticks={[-100, -50, 0, 50, 100]} 
                label={{ value: 'NPS Score', angle: -90, position: 'insideLeft' }} 
              />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="nps" 
                stroke="#2563eb" 
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Latest Feedback Table */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Latest Feedback</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-left py-3 px-4">Campaign</th>
                <th className="text-left py-3 px-4">Order ID</th>
                <th className="text-left py-3 px-4">NPS Score</th>
                <th className="text-left py-3 px-4">Feedback</th>
                <th className="text-left py-3 px-4">Responses</th>
              </tr>
            </thead>
            <tbody>
              {recentFeedback.map((feedback) => {
                // Get questions from the campaign
                const campaignQuestions = feedback.feedback_campaigns.questions || [];
                
                // Create a map of question responses
                const responseMap = new Map(
                  feedback.question_responses.map((r) => [r.question_id, r.response_value])
                );

                return (
                  <tr key={feedback.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      {new Date(feedback.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      {feedback.feedback_campaigns.name}
                    </td>
                    <td className="py-3 px-4">{feedback.order_id}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded ${
                        feedback.nps_score >= 9 ? 'bg-green-100 text-green-800' :
                        feedback.nps_score >= 7 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {feedback.nps_score}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {feedback.transcription ? (
                        <span>{feedback.transcription.slice(0, 100)}{feedback.transcription.length > 100 ? '...' : ''}</span>
                      ) : (
                        feedback.voice_file_url ? (
                          <span className="text-blue-600">Has voice recording</span>
                        ) : (
                          <span className="text-gray-400">No feedback provided</span>
                        )
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        {campaignQuestions.map((question) => (
                          <div key={question.id} className="text-sm">
                            <span className="font-medium">{question.text}:</span>{' '}
                            <span className="text-gray-600">
                              {responseMap.get(question.id) || 'No response'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Latest Summary */}
      {dailySummaries[0] && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Latest Daily Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Positive Themes</h3>
              <ul className="list-disc pl-5">
                {dailySummaries[0].positive_themes?.map((theme, i) => (
                  <li key={i} className="text-green-600">{theme}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Negative Themes</h3>
              <ul className="list-disc pl-5">
                {dailySummaries[0].negative_themes?.map((theme, i) => (
                  <li key={i} className="text-red-600">{theme}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-4">
            <h3 className="font-semibold mb-2">Summary</h3>
            <p className="text-gray-700 whitespace-pre-line">{dailySummaries[0].summary}</p>
          </div>
        </div>
      )}
    </div>
  );
}