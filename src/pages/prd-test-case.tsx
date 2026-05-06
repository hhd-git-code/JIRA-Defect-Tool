import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Steps, Button, Space, message, Divider, Modal } from 'antd';
import { UploadOutlined, EditOutlined, TranslationOutlined, CloudUploadOutlined } from '@ant-design/icons';
import PrdUpload from '../components/prd-upload';
import TestPointEditor from '../components/test-point-editor';
import TestCaseTranslate from '../components/test-case-translate';
import TestCaseCreate from '../components/test-case-create';
import { usePrdStore } from '../stores/prd-store';
import { generateTestPointsStream } from '../services/ai-service';
import { parseAiResponse } from '../services/ai-parser';
import { translateTestPoints } from '../services/test-case-translate';
import { createIssueWithFields, xrayAuthenticate, xrayResolveProjectInfo, xrayCreateTestWithDetails } from '../services/jira-api';
import { formatTestCaseDescription } from '../utils/format-test-case-description';
import { loadConfig } from '../stores/config-store';
import type { AppConfig } from '../types/config';
import type { TestPoint } from '../types/test-case';

const PrdTestCase: React.FC = () => {
  const {
    state,
    setStep,
    setPrdSource,
    setTestPoints,
    updateTestPoint,
    addTestPoint,
    removeTestPoint,
    setTranslatedTestPoints,
    updateTranslatedTestPoint,
    setGenerating,
    setStreamingText,
    setTranslating,
    setCreating,
    addCreateResult,
    reset,
  } = usePrdStore();

  const [config, setConfig] = useState<AppConfig | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    loadConfig().then(setConfig).catch(() => {});
  }, []);

  const handleSourceReady = useCallback((source: typeof state.prdSource) => {
    if (source) {
      setPrdSource(source);
      setStep(1);
    }
  }, [setPrdSource, setStep]);

  const handleGenerate = useCallback(async () => {
    if (!config?.ai.apiKey) {
      message.error('请先在设置中配置 AI 服务');
      return;
    }
    if (!state.prdSource?.content) {
      message.error('PRD 内容为空');
      return;
    }

    setGenerating(true);
    setTestPoints([]);
    setStreamingText('');

    try {
      await generateTestPointsStream(state.prdSource.content, config.ai, {
        onChunk: (accumulated) => {
          setStreamingText(accumulated);
        },
        onTestPoint: (point) => {
          addTestPoint(point);
        },
        onDone: (fullText) => {
          try {
            const finalPoints = parseAiResponse(fullText);
            setTestPoints(finalPoints);
            message.success(`已生成 ${finalPoints.length} 个测试点`);
          } catch {
            message.success('测试点生成完成');
          }
          setGenerating(false);
          setStreamingText('');
        },
        onError: (error) => {
          message.error(`生成测试点失败: ${error}`);
          setGenerating(false);
          setStreamingText('');
        },
      }, state.prdSource.type as 'file' | 'url');
    } catch (err: unknown) {
      message.error(`生成测试点失败: ${err instanceof Error ? err.message : String(err)}`);
      setGenerating(false);
      setStreamingText('');
    }
  }, [config, state.prdSource, setGenerating, setTestPoints, addTestPoint, setStreamingText]);

  const handleAddPoint = useCallback(() => {
    const newPoint: TestPoint = {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      precondition: '',
      steps: [{ action: '', expectedResult: '' }],
      priority: 'Major',
    };
    addTestPoint(newPoint);
  }, [addTestPoint]);

  const handleTranslateAndPreview = useCallback(async () => {
    if (state.testPoints.length === 0) {
      message.warning('没有测试点需要翻译');
      return;
    }

    if (!config?.jiraTestCase.serverUrl || !config?.jiraTestCase.apiToken) {
      message.error('请先在设置中配置 JIRA 测试用例连接信息');
      return;
    }

    setStep(2);
    setTranslating(true);
    try {
      const translated = await translateTestPoints(state.testPoints, config.translate);
      setTranslatedTestPoints(translated);
      message.success('翻译完成');
    } catch (err: unknown) {
      message.error(`翻译失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTranslating(false);
    }
  }, [state.testPoints, config, setStep, setTranslating, setTranslatedTestPoints]);

  const createTestCases = useCallback(async (points: TestPoint[]) => {
    const jiraConfig = config!.jiraTestCase;
    const useXray = config!.xray.enabled;
    let xrayToken = '';
    let projectInfo = null as Awaited<ReturnType<typeof xrayResolveProjectInfo>> | null;

    if (useXray) {
      if (!config!.xray.clientId || !config!.xray.clientSecret) {
        message.error('Xray 已启用但缺少 Client ID 或 Client Secret，请先在设置中配置');
        return;
      }
      try {
        xrayToken = await xrayAuthenticate(config!.xray.clientId, config!.xray.clientSecret);
        projectInfo = await xrayResolveProjectInfo(jiraConfig);
      } catch (err: unknown) {
        message.error(`Xray 初始化失败: ${err instanceof Error ? err.message : String(err) || '未知错误'}`);
        return;
      }
    }

    let sCount = 0;
    let fCount = 0;

    for (const tp of points) {
      if (cancelledRef.current) break;

      const idx = state.testPoints.indexOf(tp);
      const translated = state.translatedTestPoints[idx];
      if (!translated) continue;

      try {
        if (useXray && projectInfo) {
          const steps = translated.stepsEn.map(s => ({
            action: s.actionEn,
            result: s.expectedResultEn,
          }));
          const resp = await xrayCreateTestWithDetails(
            jiraConfig, xrayToken, projectInfo,
            translated.titleEn, translated.descriptionEn,
            steps, translated.preconditionEn || undefined,
          );
          addCreateResult({
            id: tp.id, title: tp.title, success: true,
            issueKey: resp.issueKey, preconditionKeys: resp.preconditionKeys, warnings: resp.warnings,
          });
        } else {
          const description = formatTestCaseDescription(translated);
          const fields: Record<string, unknown> = {
            project: { key: jiraConfig.projectKey },
            summary: translated.titleEn,
            description,
            issuetype: { name: jiraConfig.issueType },
          };
          const resp = await createIssueWithFields(jiraConfig, fields);
          addCreateResult({ id: tp.id, title: tp.title, success: true, issueKey: resp.key });
        }
        sCount++;
      } catch (err: unknown) {
        addCreateResult({ id: tp.id, title: tp.title, success: false, error: (err instanceof Error ? err.message : String(err)) || '创建失败' });
        fCount++;
      }
    }

    if (fCount === 0) {
      message.success(`全部 ${sCount} 条测试用例创建成功！`);
    } else {
      message.warning(`创建完成：成功 ${sCount} 条，失败 ${fCount} 条`);
    }
  }, [config, state.testPoints, state.translatedTestPoints, addCreateResult]);

  const handleStartCreate = useCallback(async () => {
    if (!config?.jiraTestCase.serverUrl) {
      message.error('请先配置 JIRA 测试用例连接信息');
      return;
    }

    setStep(3);
    setCreating(true);
    cancelledRef.current = false;

    await createTestCases(state.testPoints);

    setCreating(false);
    const allSuccess = state.createResults.length > 0 && state.createResults.every(r => r.success);
    if (allSuccess) setTimeout(() => reset(), 10000);
  }, [config, state.testPoints, setStep, setCreating, createTestCases, reset]);

  const handleCancelCreate = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const handleRetryFailed = useCallback(async () => {
    const failedIds = new Set(
      state.createResults.filter((r) => !r.success).map((r) => r.id),
    );
    const failedPoints = state.testPoints.filter((tp) => failedIds.has(tp.id));
    if (failedPoints.length === 0) return;

    setCreating(true);
    cancelledRef.current = false;

    await createTestCases(failedPoints);

    setCreating(false);
  }, [state.createResults, state.testPoints, setCreating, createTestCases]);

  const handleReset = useCallback(() => {
    Modal.confirm({
      title: '确认重置？',
      content: '所有测试点和翻译结果将被清除',
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        reset();
      },
    });
  }, [reset]);

  const isBusy = state.generating || state.translating || state.creating;

  const steps = [
    { title: '上传 PRD', icon: <UploadOutlined /> },
    { title: '编辑测试点', icon: <EditOutlined /> },
    { title: '翻译预览', icon: <TranslationOutlined /> },
    { title: '创建用例', icon: <CloudUploadOutlined /> },
  ];

  return (
    <div>
      <Steps
        current={state.currentStep}
        items={steps.map((s, i) => ({
          title: s.title,
          icon: s.icon,
          style: {
            cursor: isBusy || i > state.maxReachedStep || i === state.currentStep
              ? 'default'
              : 'pointer',
          },
        }))}
        style={{ marginBottom: 32 }}
        onChange={(step) => {
          if (isBusy) return;
          if (step <= state.maxReachedStep && step !== state.currentStep) setStep(step);
        }}
      />

      <div style={{ minHeight: 300 }}>
        {state.currentStep === 0 && (
          <PrdUpload
            onSourceReady={handleSourceReady}
            loading={state.generating}
            jiraConfig={config?.jiraTestCase}
          />
        )}

        {state.currentStep === 1 && (
          <TestPointEditor
            testPoints={state.testPoints}
            generating={state.generating}
            onUpdatePoint={updateTestPoint}
            onRemovePoint={removeTestPoint}
            onAddPoint={handleAddPoint}
            onGenerate={handleGenerate}
            hasPrdSource={!!state.prdSource?.content}
          />
        )}

        {state.currentStep === 2 && (
          <TestCaseTranslate
            testPoints={state.testPoints}
            translatedTestPoints={state.translatedTestPoints}
            onUpdateTranslated={updateTranslatedTestPoint}
            translating={state.translating}
          />
        )}

        {state.currentStep === 3 && (
          <TestCaseCreate
            total={state.testPoints.length}
            completed={state.createResults.length}
            creating={state.creating}
            results={state.createResults}
            serverUrl={config?.jiraTestCase.serverUrl}
            onCancel={handleCancelCreate}
            onRetryFailed={handleRetryFailed}
          />
        )}
      </div>

      <Divider />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          {state.currentStep > 0 && (
            <Button onClick={() => setStep(state.currentStep - 1)} disabled={isBusy}>上一步</Button>
          )}
          <Button onClick={handleReset}>重置</Button>
        </Space>
        <Space>
          {state.currentStep === 1 && state.testPoints.length > 0 && (
            <Button type="primary" onClick={handleTranslateAndPreview}>
              翻译并预览
            </Button>
          )}
          {state.currentStep === 2 && !state.translating && state.translatedTestPoints.length > 0 && (
            <Button type="primary" onClick={handleStartCreate}>
              创建 JIRA 测试用例
            </Button>
          )}
        </Space>
      </div>
    </div>
  );
};

export default PrdTestCase;
