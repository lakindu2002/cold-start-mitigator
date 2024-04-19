import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { LoadingButton } from '@mui/lab';
import {
  Box,
  Card,
  Chip,
  Button,
  Divider,
  MenuItem,
  Container,
  TextField,
  Typography,
  CardContent,
} from '@mui/material';

import { patchProject } from 'src/redux/slices/projects';
import { AWS_REGIONS, COLLECTION_FREQUENCIES } from 'src/config';

const SettingsView = () => {
  const { project } = useSelector((state) => state.projects);
  const dispatch = useDispatch();
  const [projectToEdit, setProjectToEdit] = useState({});
  const [patternInput, setPatternInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProjectToEdit(project);
  }, [project]);

  const handlePatternRemove = (index) => {
    const newPatterns = projectToEdit.patterns.filter((_, i) => i !== index);
    setProjectToEdit({ ...projectToEdit, patterns: newPatterns });
  };

  const handlePatternAdd = () => {
    if (projectToEdit.patterns.includes(patternInput)) {
      toast.error('Pattern already exists');
      return;
    }
    setProjectToEdit({
      ...projectToEdit,
      patterns: [...projectToEdit.patterns, patternInput.trim()],
    });
    setPatternInput('');
  };

  const handleSave = async () => {
    setSaving(true);
    const projectToPatch = {
      roleArn: projectToEdit.role || project.role,
      region: projectToEdit.region,
      name: projectToEdit.name,
      patterns: projectToEdit.patterns,
      frequency: projectToEdit.frequency,
    };

    // dispatch patch action
    try {
      await dispatch(patchProject(project.id, projectToPatch));
      toast.success('Project settings updated successfully');
    } catch (err) {
      toast.error('Failed to update project settings');
    } finally {
      setSaving(false);
    }
  };

  if (Object.keys(projectToEdit).length === 0) {
    return null;
  }

  return (
    <Container>
      <Typography variant="h4">{project?.name} Settings</Typography>
      <Typography variant="caption">Update your project settings</Typography>

      <Card sx={{ my: 5 }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
            }}
          >
            <TextField
              onChange={(e) => setProjectToEdit({ ...projectToEdit, name: e.target.value })}
              fullWidth
              label="Project Name"
              value={projectToEdit.name}
            />
            <TextField
              fullWidth
              name="roleArn"
              label="Role ARN"
              value={projectToEdit.role}
              onChange={(e) => setProjectToEdit({ ...projectToEdit, role: e.target.value })}
            />
            <TextField
              fullWidth
              select
              onChange={(e) => setProjectToEdit({ ...projectToEdit, region: e.target.value })}
              value={projectToEdit.region}
              helperText="Your data will be collected only from this region"
              label="AWS Region"
            >
              {AWS_REGIONS.map((eachRegion) => (
                <MenuItem value={eachRegion.code} key={eachRegion.code}>
                  {eachRegion.code} ({eachRegion.name})
                </MenuItem>
              ))}
            </TextField>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <LoadingButton
                variant="contained"
                onClick={handleSave}
                loading={saving}
                disabled={!projectToEdit.name || !projectToEdit.role || !projectToEdit.region}
              >
                Save
              </LoadingButton>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
            }}
          >
            <Box sx={{ width: '100%' }}>
              <TextField
                fullWidth
                name="pattern"
                label="Lambda Pattern"
                value={patternInput}
                onChange={(e) => setPatternInput(e.target.value)}
                helperText="Enter the patterns to match the Lambda functions you want to collect data from"
                InputProps={{
                  endAdornment: (
                    <Button onClick={handlePatternAdd} variant="outlined">
                      Add
                    </Button>
                  ),
                }}
                margin="normal"
              />
              <Box sx={{ display: 'flex', gap: 1, maxWidth: 300, flexWrap: 'wrap' }}>
                {projectToEdit.patterns?.map((eachPattern, index) => (
                  <Chip
                    key={eachPattern}
                    onDelete={() => handlePatternRemove(index)}
                    label={eachPattern}
                  />
                ))}
              </Box>
            </Box>
            <TextField
              fullWidth
              helperText={`Your data will be collected every ${projectToEdit.frequency} hour${
                projectToEdit.frequency > 1 ? 's' : ''
              } and your AI Model will be trained`}
              name="collectionFrequency"
              select
              value={projectToEdit.frequency}
              label="Collection Frequency"
              onChange={(e) => setProjectToEdit({ ...projectToEdit, frequency: e.target.value })}
            >
              {COLLECTION_FREQUENCIES.map((frequencyInHours) => (
                <MenuItem key={frequencyInHours} value={frequencyInHours}>
                  {frequencyInHours} Hour{frequencyInHours === 1 ? '' : 's'}
                </MenuItem>
              ))}
            </TextField>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <LoadingButton
                disabled={projectToEdit.patterns.length === 0}
                onClick={handleSave}
                loading={saving}
                variant="contained"
              >
                Save
              </LoadingButton>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
};

export default SettingsView;
