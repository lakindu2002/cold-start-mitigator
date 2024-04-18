import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import Container from '@mui/material/Container';
import Grid from '@mui/material/Unstable_Grid2';
import Typography from '@mui/material/Typography';
import { Box, CircularProgress } from '@mui/material';

import { useAuth } from 'src/contexts/auth-context';
import { getProjectById } from 'src/redux/slices/projects';

import AppCurrentVisits from '../app-current-visits';
import AppWebsiteVisits from '../app-website-visits';
import AppWidgetSummary from '../app-widget-summary';

// ----------------------------------------------------------------------

const formatLogCount = (logCount) => {
  // if log is in in millions, format it to 1m
  if (logCount > 1000000) {
    return `${(logCount / 1000000).toFixed(1)}MM`;
  }

  // if log count is greater than 1000, format it to 1k
  if (logCount > 1000) {
    return `${(logCount / 1000).toFixed(1)}K`;
  }

  // if log count is less than 1000, return the same number
  return logCount;
};

export default function AppView() {
  const { user } = useAuth();
  const { project, projectLoading } = useSelector((state) => state.projects);
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(getProjectById(user?.currentProject.id));
  }, [dispatch, user?.currentProject.id]);

  const chartSeries = Object.values(project.logsByDay).reduce((acc, curr) => {
    Object.entries(curr).forEach(([key, value]) => {
      const item = acc.find((eachAcc) => eachAcc.name === key);
      if (item) {
        item.data.push(value);
      } else {
        acc.push({ name: key, data: [value], type: 'line', fill: 'solid' });
      }
    });
    return acc;
  }, []);

  if (projectLoading) {
    return (
      <Box sx={{ my: 35, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl">
      <Typography variant="h4" sx={{ mb: 5 }}>
        Hi {user?.fullName}, Welcome back 👋
      </Typography>

      <Grid container spacing={3}>
        <Grid xs={12} sm={4} md={4}>
          <AppWidgetSummary
            title="Lambda Functions"
            total={project.functionCount}
            color="success"
            icon={<img alt="icon" src="/assets/icons/lambda.png" />}
          />
        </Grid>

        <Grid xs={12} sm={4} md={4}>
          <AppWidgetSummary
            title="Logs"
            total={formatLogCount(project.logCount)}
            color="warning"
            icon={<img alt="icon" src="/assets/icons/cloudwatch.png" />}
          />
        </Grid>

        <Grid xs={12} sm={4} md={4}>
          <AppWidgetSummary
            title="Cold Starts"
            total={formatLogCount(project.coldStartEvents)}
            color="error"
            icon={<img alt="icon" src="/assets/icons/cold.png" />}
          />
        </Grid>

        <Grid xs={12} md={6} lg={8}>
          <AppWebsiteVisits
            title="Function Invocations"
            chart={{
              labels: Object.keys(project.logsByDay),
              series: chartSeries,
            }}
          />
        </Grid>

        <Grid xs={12} md={6} lg={4}>
          <AppCurrentVisits
            title="Top 5 Cold Start Functions"
            chart={{
              series: Object.entries(project.functionsWithMostColdStarts).map(([key, value]) => ({
                label: key,
                value,
              })),
            }}
          />
        </Grid>
      </Grid>
    </Container>
  );
}
