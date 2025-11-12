import React from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, TextInput, Group, Button } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useJson from "../../../store/useJson";
import useFile from "../../../store/useFile";
import { jsonToContent } from "../../../lib/utils/jsonAdapter";
import { applyMultipleEdits } from "../../../lib/utils/jsonEdit";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const getJson = useJson(state => state.getJson);
  const getFormat = useFile(state => state.getFormat);
  const setContents = useFile(state => state.setContents);

  const [isEditing, setIsEditing] = React.useState(false);
  const [editedValues, setEditedValues] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!opened || !nodeData) return;
    // Initialize form values from node rows (only primitive rows)
    const initial: Record<string, string> = {};
    const rows = nodeData.text ?? [];
    if (rows.length === 1 && !rows[0].key) {
      // singular value node
      initial.__value = String(rows[0].value ?? "");
    } else {
      rows.forEach(r => {
        if (r.key && r.type !== "array" && r.type !== "object") {
          initial[r.key] = String(r.value ?? "");
        }
      });
    }
    setEditedValues(initial);
    setIsEditing(false);
  }, [opened, nodeData]);

  const coerceValue = (raw: string, type: NodeData["text"][number]["type"]) => {
    if (type === "number") {
      const n = Number(raw);
      return Number.isFinite(n) ? n : raw;
    }
    if (type === "boolean") return raw === "true";
    if (type === "null") return null;
    return raw; // string or fallback
  };

  const handleSave = async () => {
    if (!nodeData) return;
    let baseJson = getJson();

    // Prepare updates: for a leaf node, use its own path; for object rows, append key
    const updates: Array<{ path: any; value: unknown }> = [];
    const rows = nodeData.text ?? [];
    if (rows.length === 1 && !rows[0].key) {
      const row = rows[0];
      const val = coerceValue(editedValues.__value, row.type);
      updates.push({ path: nodeData.path ?? [], value: val });
    } else {
      rows.forEach(row => {
        if (!row.key || row.type === "array" || row.type === "object") return;
        const raw = editedValues[row.key];
        const val = coerceValue(raw, row.type);
        const path = [...(nodeData.path ?? []), row.key];
        updates.push({ path, value: val });
      });
    }

    try {
      const updatedJson = applyMultipleEdits(baseJson, updates);
      const format = getFormat();
      const nextContents = await jsonToContent(updatedJson, format);
      setContents({ contents: nextContents, hasChanges: true });
      setIsEditing(false);
      onClose?.();
    } catch (error) {
      console.error("Failed to save edits", error);
    }
  };

  const handleCancel = () => {
    // Discard local edits only
    setIsEditing(false);
  };

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              {isEditing ? "Edit Content" : "Content"}
            </Text>
            <CloseButton onClick={onClose} />
          </Flex>

          {!isEditing ? (
            <ScrollArea.Autosize mah={250} maw={600}>
              <CodeHighlight
                code={normalizeNodeData(nodeData?.text ?? [])}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            </ScrollArea.Autosize>
          ) : (
            <Stack gap="xs">
              {/* Singular value */}
              {nodeData?.text?.length === 1 && !nodeData?.text?.[0]?.key ? (
                <TextInput
                  label="Value"
                  value={editedValues.__value ?? ""}
                  onChange={e => setEditedValues(prev => ({ ...prev, __value: e.currentTarget.value }))}
                  data-autofocus
                />
              ) : (
                // Object primitive properties
                nodeData?.text
                  ?.filter(r => r.key && r.type !== "array" && r.type !== "object")
                  .map(r => (
                    <TextInput
                      key={String(r.key)}
                      label={String(r.key)}
                      value={editedValues[String(r.key)] ?? ""}
                      onChange={e =>
                        setEditedValues(prev => ({ ...prev, [String(r.key)]: e.currentTarget.value }))
                      }
                    />
                  ))
              )}
            </Stack>
          )}
        </Stack>

        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>

        <Group justify="right" mt="sm">
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} variant="filled" color="blue">
              Edit
            </Button>
          ) : (
            <>
              <Button variant="light" color="red" onClick={handleCancel} aria-label="cancel-edit">
                Cancel
              </Button>
              <Button onClick={handleSave} color="green" aria-label="save-edit">
                Save
              </Button>
            </>
          )}
        </Group>
      </Stack>
    </Modal>
  );
};
