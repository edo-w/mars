using Dapper;
using Mars.Local.Db;

namespace Mars.Local.App.LocalWorkflow;

public class LocalWorkflowRepo
{
	private readonly WorkflowDbSession session;

	public LocalWorkflowRepo(WorkflowDbSession session)
	{
		this.session = session;
	}

	public void CreateRun(WorkflowRunModel model)
	{
		const string sql = """
			INSERT INTO workflow_run (
				id,
				source_path,
				manifest_path,
				state,
				create_date,
				end_date,
				input_json,
				output_json,
				error
			)
			VALUES (
				@Id,
				@SourcePath,
				@ManifestPath,
				@State,
				@CreateDate,
				@EndDate,
				@InputJson,
				@OutputJson,
				@Error
			)
			""";

		using var connection = this.session.Open();
		connection.Execute(sql, model);
	}

	public void UpdateRun(WorkflowRunModel model)
	{
		const string sql = """
			UPDATE workflow_run
			SET
				state = @State,
				end_date = @EndDate,
				output_json = @OutputJson,
				error = @Error
			WHERE id = @Id
			""";

		using var connection = this.session.Open();
		connection.Execute(sql, model);
	}

	public WorkflowRunModel? GetRun(string id)
	{
		const string sql = """
			SELECT
				id AS Id,
				source_path AS SourcePath,
				manifest_path AS ManifestPath,
				state AS State,
				create_date AS CreateDate,
				end_date AS EndDate,
				input_json AS InputJson,
				output_json AS OutputJson,
				error AS Error
			FROM workflow_run
			WHERE id = @Id
			""";
		var parameters = new { Id = id };

		using var connection = this.session.Open();
		var model = connection.QuerySingleOrDefault<WorkflowRunModel>(sql, parameters);

		return model;
	}

	public IReadOnlyList<WorkflowRunModel> ListRuns()
	{
		const string sql = """
			SELECT
				id AS Id,
				source_path AS SourcePath,
				manifest_path AS ManifestPath,
				state AS State,
				create_date AS CreateDate,
				end_date AS EndDate,
				input_json AS InputJson,
				output_json AS OutputJson,
				error AS Error
			FROM workflow_run
			ORDER BY
				create_date DESC,
				id DESC
			""";

		using var connection = this.session.Open();
		var models = connection.Query<WorkflowRunModel>(sql).ToArray();

		return models;
	}

	public void CreateStep(WorkflowStepModel model)
	{
		const string sql = """
			INSERT INTO workflow_step (
				id,
				run_id,
				source_id,
				source_path,
				source_line,
				source_column,
				kind,
				target,
				state,
				create_date,
				end_date,
				input_json,
				output_json,
				error
			)
			VALUES (
				@Id,
				@RunId,
				@SourceId,
				@SourcePath,
				@SourceLine,
				@SourceColumn,
				@Kind,
				@Target,
				@State,
				@CreateDate,
				@EndDate,
				@InputJson,
				@OutputJson,
				@Error
			)
			""";

		using var connection = this.session.Open();
		connection.Execute(sql, model);
	}

	public void UpdateStep(WorkflowStepModel model)
	{
		const string sql = """
			UPDATE workflow_step
			SET
				state = @State,
				end_date = @EndDate,
				output_json = @OutputJson,
				error = @Error
			WHERE id = @Id
			""";

		using var connection = this.session.Open();
		connection.Execute(sql, model);
	}

	public void AppendEvent(WorkflowEventModel model)
	{
		const string sql = """
			INSERT INTO workflow_event (
				id,
				run_id,
				step_id,
				name,
				message,
				data_json,
				create_date
			)
			VALUES (
				@Id,
				@RunId,
				@StepId,
				@Name,
				@Message,
				@DataJson,
				@CreateDate
			)
			""";

		using var connection = this.session.Open();
		connection.Execute(sql, model);
	}
}
