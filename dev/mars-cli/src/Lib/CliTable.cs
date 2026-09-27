using System.Text;

namespace Mars.Cli.Lib;

public class CliTable
{
	private readonly List<string[]> rows = [];
	private readonly HashSet<int> rightAlignedColumns = [];
	private readonly Dictionary<int, int> minimumWidths = [];
	private int? columnCount;

	public void AddRow(params string[] cells)
	{
		if (cells.Length == 0)
		{
			throw new ArgumentException("A table row needs at least one column.", nameof(cells));
		}

		if (this.columnCount is null)
		{
			this.columnCount = cells.Length;
		}
		else if (cells.Length != this.columnCount.Value)
		{
			throw new ArgumentException("Every table row must have the same number of columns.", nameof(cells));
		}

		this.rows.Add(cells);
	}

	public void RightAlignColumn(int index)
	{
		this.rightAlignedColumns.Add(index);
	}

	public void SetMinimumWidth(int index, int width)
	{
		ArgumentOutOfRangeException.ThrowIfNegative(width);

		this.minimumWidths[index] = width;
	}

	public async Task WriteAsync(TextWriter output)
	{
		if (this.columnCount is null)
		{
			return;
		}

		var widths = new int[this.columnCount.Value];
		for (var column = 0; column < widths.Length; column++)
		{
			this.minimumWidths.TryGetValue(column, out var minimumWidth);
			widths[column] = minimumWidth;
		}

		foreach (var row in this.rows)
		{
			for (var column = 0; column < row.Length; column++)
			{
				widths[column] = Math.Max(widths[column], row[column].Length);
			}
		}

		foreach (var row in this.rows)
		{
			var line = new StringBuilder();
			for (var column = 0; column < row.Length; column++)
			{
				if (column > 0)
				{
					line.Append("  ");
				}

				var cell = row[column];
				var isLastColumn = column == row.Length - 1;
				if (isLastColumn)
				{
					line.Append(cell);
				}
				else if (this.rightAlignedColumns.Contains(column))
				{
					line.Append(cell.PadLeft(widths[column]));
				}
				else
				{
					line.Append(cell.PadRight(widths[column]));
				}
			}

			await output.WriteLineAsync(line.ToString());
		}
	}
}
