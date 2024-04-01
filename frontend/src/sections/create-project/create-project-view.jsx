import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import { LoadingButton } from '@mui/lab';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { Chip, Button, MenuItem, TextField } from '@mui/material';

import axios from 'src/lib/axios';
import { bgGradient } from 'src/theme/css';
import { useAuth } from 'src/contexts/auth-context';
import { AWS_REGIONS, COLLECTION_FREQUENCIES } from 'src/config';

const Step01 = ({ onProjectCreated }) => {
  const [projectName, setProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  const handleCreateClick = async () => {
    setCreatingProject(true);
    try {
      const resp = await axios.post('/api/projects/integration/create', {
        name: projectName.trim(),
      });
      const { projectId, stackCreationUrl } = resp.data;
      onProjectCreated({ projectId, stackCreationUrl });
    } catch (err) {
      toast.error('We ran into an error while creating the project. Please try again');
    } finally {
      setCreatingProject(false);
    }
  };

  const handleProjectNameChange = (e) => {
    setProjectName(e.target.value);
  };

  return (
    <Box>
      <Typography variant="h4">Initialize a Project</Typography>

      <Typography variant="body2" sx={{ mt: 2 }}>
        Let&apos;s start by creating an integration with your AWS Account.
      </Typography>
      <Typography variant="body2" sx={{ mt: 2, mb: 5 }}>
        To do so, enter your project name and click &quot;Create My Project&quot; to provision an
        IAM Role on the tenant AWS Account
      </Typography>
      <Box>
        <TextField
          onChange={handleProjectNameChange}
          name="name"
          value={projectName}
          fullWidth
          placeholder="Project Name"
        />
        <LoadingButton
          onClick={handleCreateClick}
          size="large"
          variant="contained"
          color="inherit"
          sx={{ mt: 3 }}
          loading={creatingProject}
          disabled={!projectName}
          fullWidth
        >
          Create My Project
        </LoadingButton>
      </Box>
    </Box>
  );
};

const Step02 = ({ projectId, onBackPress, onConfirmed }) => {
  const [roleArn, setRoleArn] = useState('');
  const [confirming, setConfirming] = useState(false);

  const handleRoleArnChange = (e) => {
    setRoleArn(e.target.value.trim());
  };

  const handleProjectConfirm = async () => {
    try {
      setConfirming(true);
      await axios.post(`/api/projects/${projectId}/integration/ping`, { roleArn });
      onConfirmed();
    } catch (err) {
      toast.error('We ran into an error while locating the ARN. Please try again');
    } finally {
      setConfirming(false);
    }
  };
  return (
    <>
      <Typography variant="h4">Initialize a Project</Typography>

      <Typography variant="body2" sx={{ mt: 2 }}>
        Let&apos;s test the connection with your AWS Account
      </Typography>
      <Typography variant="body2" sx={{ mt: 2, mb: 5 }}>
        To do so, copy and paste the ARN of the role that was created in the CloudFormation Stack
        and click &quot;Confirm ARN&quot;.
      </Typography>
      <TextField fullWidth name="roleArn" onChange={handleRoleArnChange} label="Enter Role ARN" />
      <Box sx={{ my: 2, gap: 2, display: 'flex' }}>
        <Button onClick={onBackPress} size="large" variant="outlined">
          Back
        </Button>
        <LoadingButton
          disabled={!roleArn}
          onClick={handleProjectConfirm}
          size="large"
          fullWidth
          color="inherit"
          variant="contained"
          loading={confirming}
        >
          Confirm ARN
        </LoadingButton>
      </Box>
    </>
  );
};

const Step03 = ({ projectId, onBackPress, onConfirmed }) => {
  const [region, setRegion] = useState(AWS_REGIONS[0].code);
  const [frequency, setFrequency] = useState(COLLECTION_FREQUENCIES[0]);
  const [patterns, setPatterns] = useState([]);
  const [pattern, setPattern] = useState('');
  const [confirming, setConfirming] = useState(false);
  const { reloadUser } = useAuth();

  const isDisabled = useMemo(
    () => !region || !frequency || patterns.length === 0,
    [frequency, patterns.length, region]
  );

  const handleSaveChanges = async () => {
    setConfirming(true);
    try {
      await axios.patch(`/api/projects/${projectId}`, { region, frequency, patterns });
      await reloadUser();
      toast.success(
        'Your project has been created. It may take some time for data to be shown here'
      );
      onConfirmed();
    } catch (err) {
      toast.error('We ran into an error while creating the project');
    } finally {
      setConfirming(false);
    }
  };

  const handlePatternChange = (e) => {
    setPattern(e.target.value);
  };

  const handlePatternAdd = () => {
    if (patterns.includes(pattern.trim())) {
      toast.error(`You've already added this pattern`);
      return;
    }
    setPatterns((prev) => [...prev, pattern.trim()]);
    setPattern('');
  };

  const handlePatternRemove = (index) => {
    setPatterns((prev) => prev.filter((_p, i) => i !== index));
  };

  const handleFrequencyChange = (e) => {
    setFrequency(e.target.value);
  };

  const handleRegionChange = (e) => {
    setRegion(e.target.value);
  };

  return (
    <>
      <Typography variant="h4">Initialize a Project</Typography>

      <Typography variant="body2" sx={{ mt: 2 }}>
        Let&apos;s configure your project.
      </Typography>
      <Typography variant="body2" sx={{ mt: 2, mb: 5 }}>
        HeatShield periodically collects logs from your AWS account to train your own model. So, you
        can tune the collection frequency, Lambda Pattern and Region.
      </Typography>
      <TextField
        value={frequency}
        onChange={handleFrequencyChange}
        fullWidth
        helperText={`Your data will be collected every ${frequency} hour${
          frequency > 1 ? 's' : ''
        } and your AI Model will be trained`}
        name="collectionFrequency"
        select
        label="Collection Frequency"
      >
        {COLLECTION_FREQUENCIES.map((frequencyInHours) => (
          <MenuItem key={frequencyInHours} value={frequencyInHours}>
            {frequencyInHours} Hour{frequencyInHours === 1 ? '' : 's'}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        onChange={handlePatternChange}
        value={pattern}
        fullWidth
        name="pattern"
        label="Lambda Pattern"
        InputProps={{
          endAdornment: (
            <Button disabled={!pattern} onClick={handlePatternAdd} variant="contained">
              Add
            </Button>
          ),
        }}
        margin="normal"
      />

      <Box sx={{ display: 'flex', gap: 1, maxWidth: 300, flexWrap: 'wrap' }}>
        {patterns.map((eachPattern, index) => (
          <Chip key={eachPattern} onDelete={() => handlePatternRemove(index)} label={eachPattern} />
        ))}
      </Box>

      <TextField
        value={region}
        onChange={handleRegionChange}
        fullWidth
        name="awsRegion"
        select
        helperText="Your data will be collected only from this region"
        label="AWS Region"
        margin="normal"
      >
        {AWS_REGIONS.map((eachRegion) => (
          <MenuItem value={eachRegion.code} key={eachRegion.code}>
            {eachRegion.code} ({eachRegion.name})
          </MenuItem>
        ))}
      </TextField>

      <Box sx={{ my: 2, gap: 2, display: 'flex' }}>
        <Button onClick={onBackPress} size="large" variant="outlined">
          Back
        </Button>
        <LoadingButton
          onClick={handleSaveChanges}
          size="large"
          fullWidth
          loading={confirming}
          disabled={isDisabled}
          color="inherit"
          variant="contained"
        >
          Finalize Project
        </LoadingButton>
      </Box>
    </>
  );
};

export default function CreateProjectView() {
  const theme = useTheme();
  const [projectId, setProjectId] = useState('');
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const handleProjectCreated = ({ projectId: createdProjectId, stackCreationUrl }) => {
    setProjectId(createdProjectId);
    const element = document.createElement('a');
    element.href = stackCreationUrl;
    element.target = '_blank';
    element.click();
    setStep(1);
  };

  const handleMoveToProject = () => {
    navigate(`/projects/${projectId}`);
  };

  const steps = {
    first: <Step01 onProjectCreated={handleProjectCreated} />,
    second: (
      <Step02 onBackPress={() => setStep(0)} projectId={projectId} onConfirmed={() => setStep(2)} />
    ),
    third: (
      <Step03
        onBackPress={() => setStep(1)}
        projectId={projectId}
        onConfirmed={handleMoveToProject}
      />
    ),
  };

  return (
    <Box
      sx={{
        ...bgGradient({
          color: alpha(theme.palette.background.default, 0.9),
          imgUrl: '/assets/background/overlay_4.jpg',
        }),
        height: 1,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <Card
        sx={{
          p: 5,
          width: '100%',
          height: '80%',
          mx: 20,
          my: 10,
        }}
      >
        <Box sx={{ display: 'flex', gap: 8, alignItems: 'center', height: '100%' }}>
          <Box>
            {step === 0 && steps.first}
            {step === 1 && steps.second}
            {step === 2 && steps.third}
          </Box>
          <Box>
            <img src="/assets/images/aws-logo.png" alt="AWS Logo" width="100%" />
          </Box>
        </Box>
      </Card>
    </Box>
  );
}

Step01.propTypes = {
  onProjectCreated: PropTypes.func.isRequired,
};

Step02.propTypes = {
  projectId: PropTypes.string.isRequired,
  onBackPress: PropTypes.func.isRequired,
  onConfirmed: PropTypes.func.isRequired,
};

Step03.propTypes = {
  projectId: PropTypes.string.isRequired,
  onBackPress: PropTypes.func.isRequired,
  onConfirmed: PropTypes.func.isRequired,
};
