from flask import Flask, render_template, request, jsonify, send_file
import google.generativeai as genai
import json
import uuid
import os
from datetime import datetime
import csv
import io
from typing import List, Dict, Any

app = Flask(__name__)

# Configure Gemini API
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
model = genai.GenerativeModel('gemini-2.0-flash-exp')

# In-memory storage for tasks
tasks_storage = []

class TaskProcessor:
    @staticmethod
    def process_tasks_with_gemini(raw_tasks: List[str], priority_scale: str = "1-5", 
                                max_tags: int = 2, include_time_estimates: bool = True) -> List[Dict[str, Any]]:
        if not os.getenv('GEMINI_API_KEY'):
            raise Exception("Gemini API key is not configured")
        
        system_prompt = f"""You are an expert task management assistant. Your job is to analyze messy, unstructured task descriptions and transform them into clean, organized tasks.

For each task, you should:
1. Create a clear, concise summary (max 50 characters)
2. Assign {max_tags} relevant tags (use lowercase with hyphens, e.g., urgent, frontend, client, bug-fix, meeting, backend, database, review, design, documentation, testing, maintenance)
3. Assign a priority score based on the {priority_scale} scale:
   {priority_scale == "1-5" and "1 = lowest priority, 5 = highest priority" or 
    priority_scale == "1-3" and "1 = low priority, 2 = medium priority, 3 = high priority" or
    "low = routine tasks, med = important tasks, high = urgent tasks"}
{include_time_estimates and "4. Provide a realistic time estimate (e.g., '2-3 hours', '30 minutes', '1 day')" or ""}

Consider these factors for priority:
- Urgency keywords (urgent, asap, critical, immediately)
- Impact on users or business
- Dependencies and blockers
- Deadlines mentioned

Respond with a JSON object containing an array called "tasks" where each task has: summary, tags (array), priority (number), {include_time_estimates and "timeEstimate," or ""} rawText."""

        user_prompt = f"""Please process these {len(raw_tasks)} task descriptions:

{chr(10).join([f"{i+1}. {task}" for i, task in enumerate(raw_tasks)])}

Return the processed tasks in the specified JSON format."""

        try:
            response = model.generate_content(
                f"{system_prompt}\n\n{user_prompt}",
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.3,
                )
            )
            
            result = json.loads(response.text)
            
            if 'tasks' not in result or not isinstance(result['tasks'], list):
                raise Exception("Invalid response format from Gemini")
            
            processed_tasks = []
            max_priority = 5 if priority_scale == "1-5" else (3 if priority_scale == "1-3" else 3)
            
            for i, task in enumerate(result['tasks']):
                processed_task = {
                    'id': str(uuid.uuid4()),
                    'rawText': raw_tasks[i] if i < len(raw_tasks) else task.get('rawText', ''),
                    'summary': task.get('summary', 'Untitled Task'),
                    'tags': task.get('tags', [])[:max_tags],
                    'priority': max(1, min(max_priority, task.get('priority', 1))),
                    'timeEstimate': task.get('timeEstimate') if include_time_estimates else None,
                    'createdAt': datetime.now().isoformat()
                }
                processed_tasks.append(processed_task)
            
            return processed_tasks
            
        except Exception as e:
            print(f"Gemini API error: {e}")
            raise Exception(f"Failed to process tasks with Gemini: {str(e)}")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/tasks/process', methods=['POST'])
def process_tasks():
    try:
        data = request.get_json()
        raw_tasks = data.get('rawTasks', [])
        priority_scale = data.get('priorityScale', '1-5')
        max_tags = data.get('maxTags', 2)
        include_time_estimates = data.get('includeTimeEstimates', True)
        
        if not raw_tasks or len(raw_tasks) == 0:
            return jsonify({'error': 'No tasks provided'}), 400
        
        if len(raw_tasks) > 20:
            return jsonify({'error': 'Too many tasks (max 20)'}), 400
        
        # Clear existing tasks
        global tasks_storage
        tasks_storage = []
        
        # Process tasks with Gemini
        processed_tasks = TaskProcessor.process_tasks_with_gemini(
            raw_tasks, priority_scale, max_tags, include_time_estimates
        )
        
        # Store tasks
        tasks_storage.extend(processed_tasks)
        
        return jsonify({'tasks': processed_tasks})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    try:
        # Sort by creation date (newest first)
        sorted_tasks = sorted(tasks_storage, key=lambda x: x['createdAt'], reverse=True)
        return jsonify({'tasks': sorted_tasks})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tasks/stats', methods=['GET'])
def get_task_stats():
    try:
        if not tasks_storage:
            return jsonify({
                'totalTasks': 0,
                'highPriority': 0,
                'mediumPriority': 0,
                'lowPriority': 0,
                'totalEstimatedTime': '0h',
                'mostCommonTags': []
            })
        
        high_priority = len([t for t in tasks_storage if t['priority'] >= 4])
        medium_priority = len([t for t in tasks_storage if t['priority'] == 3])
        low_priority = len([t for t in tasks_storage if t['priority'] <= 2])
        
        # Calculate total estimated time
        total_minutes = 0
        for task in tasks_storage:
            if task.get('timeEstimate'):
                estimate = task['timeEstimate'].lower()
                if 'hour' in estimate:
                    hours = 2  # Default estimate
                    if '1' in estimate: hours = 1
                    elif '2-3' in estimate: hours = 2.5
                    elif '4-6' in estimate: hours = 5
                    total_minutes += hours * 60
                elif 'minute' in estimate:
                    if '30' in estimate: total_minutes += 30
                    else: total_minutes += 60
                elif 'day' in estimate:
                    days = 1
                    if '2-3' in estimate: days = 2.5
                    total_minutes += days * 8 * 60
        
        total_hours = round(total_minutes / 60)
        
        # Calculate most common tags
        tag_counts = {}
        for task in tasks_storage:
            for tag in task.get('tags', []):
                tag_counts[tag] = tag_counts.get(tag, 0) + 1
        
        most_common_tags = [
            {'tag': tag, 'count': count} 
            for tag, count in sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        ]
        
        return jsonify({
            'totalTasks': len(tasks_storage),
            'highPriority': high_priority,
            'mediumPriority': medium_priority,
            'lowPriority': low_priority,
            'totalEstimatedTime': f'{total_hours}h',
            'mostCommonTags': most_common_tags
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tasks', methods=['DELETE'])
def clear_tasks():
    try:
        global tasks_storage
        tasks_storage = []
        return jsonify({'message': 'All tasks cleared successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tasks/export', methods=['GET'])
def export_tasks():
    try:
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow(['ID', 'Summary', 'Original Text', 'Priority', 'Tags', 'Time Estimate', 'Created At'])
        
        # Write tasks
        for task in tasks_storage:
            writer.writerow([
                task['id'],
                task['summary'],
                task['rawText'],
                task['priority'],
                '; '.join(task.get('tags', [])),
                task.get('timeEstimate', ''),
                task['createdAt']
            ])
        
        # Create file-like object
        output.seek(0)
        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8')),
            mimetype='text/csv',
            as_attachment=True,
            download_name='processed-tasks.csv'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)