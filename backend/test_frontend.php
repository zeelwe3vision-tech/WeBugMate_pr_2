<?php
session_start();
// --- CONFIGURATION ---
// $python_api_url = "http://127.0.0.1:8000/chat/dual";
$mode = $_GET['mode'] ?? $_POST['mode'] ?? "dual";  // dual | common
$python_api_url = "http://127.0.0.1:8000/chat/" . $mode;


// Get user input from POST or GET
$user_input = $_POST['message'] ?? $_GET['message'] ?? "Show me my projects in a table";
$project_id = $_POST['project_id'] ?? $_GET['project_id'] ?? "123";

// --- CURL REQUEST TO PYTHON ---
$ch = curl_init($python_api_url);
$payload = json_encode([
    "message" => $user_input, 
    "project_id" => $project_id,
    "email" => $_SESSION['user_email'] ?? "test@example.com" // Add your session handling
]);

curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer debugmate123'
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($http_code != 200) {
    die("Error: API returned status code $http_code");
}

$data = json_decode($response, true);

// Check if response is valid
if (!$data || !isset($data['reply'])) {
    die("Invalid response from server");
}

$reply = $data['reply'] ?? 'No response from AI';
$is_tabular = $data['is_tabular'] ?? false;

// --- DYNAMIC PARSER FOR TABLES ---
// --- DYNAMIC PARSER FOR TABLES (REPLACED) ---
$table_html = '';

// If the API reply already contains an HTML table, trust it and render directly.
if (stripos($reply, '<table') !== false) {
    $table_html = $reply;
}
// If API returned a JSON object with a projects array (older endpoints might), build table from that.
elseif (!empty($data['projects']) && is_array($data['projects'])) {
    $rows = $data['projects'];
    // Determine headers from first row
    $headers = array_keys($rows[0]);

    $table_html .= '<div class="table-responsive"><table class="ai-ui-table" style="width:100%;border-collapse:collapse;font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Arial;font-size:13px;background:#fff;box-shadow:0 6px 18px rgba(15,23,42,0.06);border-radius:8px;overflow:hidden;">';
    // header
    $table_html .= '<thead style="background:#f7fafc;color:#111827;font-weight:600;"><tr>';
    foreach ($headers as $h) {
        $label = ucwords(str_replace('_', ' ', $h));
        $table_html .= '<th style="padding:12px 14px;text-align:left;border-bottom:1px solid #e6e9ee;">' . htmlspecialchars($label) . '</th>';
    }
    $table_html .= '</tr></thead><tbody>';

    // rows
    foreach ($rows as $r) {
        $table_html .= '<tr>';
        foreach ($headers as $h) {
            $cell = isset($r[$h]) ? $r[$h] : '';
            if (is_array($cell) || is_object($cell)) {
                $cell = json_encode($cell, JSON_UNESCAPED_UNICODE);
            }
            $cell_html = $cell !== '' ? htmlspecialchars($cell) : '<small style="color:#6b7280">—</small>';
            $table_html .= '<td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;">' . $cell_html . '</td>';
        }
        $table_html .= '</tr>';
    }
    $table_html .= '</tbody></table></div>';
}
// Fallback: if response looks like Markdown table (old flow), keep the old parser (very small fallback).
elseif ($is_tabular && strpos($reply, '|') !== false) {
    // Simple fallback: parse markdown-style table (previous behavior) — last-resort only.
    $lines = explode("\n", trim($reply));
    $in_table = false;
    $headers = []; $rows = [];
    foreach ($lines as $line) {
        $trimmed = trim($line);
        if (strpos($trimmed, '|') !== false && strpos($trimmed, '---') === false && !$in_table) {
            $in_table = true;
            $header_cells = array_filter(explode('|', $trimmed), function($cell){ return trim($cell) !== ''; });
            $headers = array_map('trim', $header_cells);
            continue;
        }
        if ($in_table && strpos($trimmed, '---') !== false) continue;
        if ($in_table && strpos($trimmed, '|') !== false) {
            $cells = array_filter(explode('|', $trimmed), function($cell){ return trim($cell) !== ''; });
            if (count($cells) === count($headers)) $rows[] = array_map('trim', $cells);
            continue;
        }
        if ($in_table && $trimmed === '') break;
    }
    if (!empty($headers) && !empty($rows)) {
        $table_html .= '<div class="table-responsive"><table class="ai-ui-table">';
        $table_html .= '<thead><tr>';
        foreach ($headers as $header) $table_html .= '<th>' . htmlspecialchars(ucwords(str_replace('_',' ',$header))) . '</th>';
        $table_html .= '</tr></thead><tbody>';
        foreach ($rows as $row) {
            $table_html .= '<tr>';
            foreach ($row as $cell) $table_html .= '<td>' . htmlspecialchars($cell) . '</td>';
            $table_html .= '</tr>';
        }
        $table_html .= '</tbody></table></div>';
    }
}

// If still empty, show raw reply inside a simple box
if (empty($table_html)) {
    $table_html = '<div class="alert alert-secondary" role="alert" style="background:#fff;border:1px solid #eef2f6;color:#0f172a;">' .
                  '<strong>Response:</strong><div style="margin-top:8px;">' . nl2br(htmlspecialchars($reply)) . '</div></div>';
}

?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Chat with Table Responses</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        .ai-ui-table-wrap{
    max-width:100%;
    overflow: auto;
    border-radius:10px;
    background:#fff;
    box-shadow:0 6px 18px rgba(15,23,42,0.06);
    padding:10px;
}
.ai-ui-table{
    width:100%;
    border-collapse:collapse;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial;
    font-size:13px;
}
.ai-ui-table thead th{
    background:#f7fafc;
    color:#111827;
    font-weight:600;
    padding:12px 14px;
    border-bottom:1px solid #e6e9ee;
    text-align:left;
}
.ai-ui-table tbody td{
    padding:12px 14px;
    border-bottom:1px solid #f1f5f9;
    color:#0f172a;
}
.ai-ui-table tbody tr:hover{
    background:#fbfdff;
}
.ai-kv-table{
    max-width:100%;
    overflow:auto;
    border-radius:10px;
    background:#fff;
    box-shadow:0 6px 18px rgba(15,23,42,0.06);
    padding:10px;
}
.ai-kv-table table{
    width:100%;
    border-collapse:collapse;
}
.ai-kv-table th{
    width:35%;
    background:#f7fafc;
    padding:12px 14px;
    border-bottom:1px solid #e6e9ee;
    text-align:left;
}
.ai-kv-table td{
    padding:12px 14px;
    border-bottom:1px solid #f1f5f9;
}
.chat-container {
    max-width: 1000px;
    margin: 20px auto;
    padding: 20px;
}
.query-info {
    background-color: #e9ecef;
    padding: 10px;
    border-radius: 5px;
    margin-bottom: 20px;
}


    </style>
</head>
<body>
    <div class="container chat-container">
        <h1 class="mb-4">AI Chat with Table Responses</h1>
        
        <div class="query-info">
            <p><strong>Query:</strong> <?php echo htmlspecialchars($user_input); ?></p>
            <p><strong>Project ID:</strong> <?php echo htmlspecialchars($project_id); ?></p>
            <p><strong>Response Type:</strong> <?php echo $is_tabular ? '📊 Tabular' : '💬 Text'; ?></p>
        </div>
        
        <?php if (!$is_tabular || empty($table_html)): ?>
        <!-- Text Response -->
            <div class="card">
                <div class="card-header bg-primary text-white">
                    AI Response
                </div>
                <div class="card-body">
                    <?php
                    // If reply contains HTML table, render it directly
                    if (stripos($reply, '<table') !== false) {
                        echo $reply;
                    } else {
                        echo nl2br(htmlspecialchars($reply));
                    }
                    ?>
                </div>
            </div>
        <?php endif; ?>

         
        <?php if ($is_tabular && !empty($table_html)): ?>
            <!-- Table Response -->
            <div class="card mt-4">
                <div class="card-header bg-success text-white">
                    📊 Table Response
                </div>
                <div class="card-body">
                    <?php echo $table_html; ?>
                </div>
            </div>
            
        <?php endif; ?>
        
        <div class="mt-4">
            <a href="?message=Show me my projects in a table&project_id=123" class="btn btn-primary">Example: Projects Table</a>
            <a href="?message=What is the status of my project?&project_id=123" class="btn btn-secondary">Example: Text Response</a>
        </div>
    </div>
</body>
</html>